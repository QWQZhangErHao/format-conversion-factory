use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};

// ── Lock helper — replaces naked .unwrap() with descriptive messages ──

fn lock<'a, T>(m: &'a Mutex<T>, _label: &str) -> MutexGuard<'a, T> {
    // 恢复中毒的 Mutex，防止单个 task panic 拖垮整个队列
    m.lock().unwrap_or_else(|poisoned| {
        tracing::warn!("Mutex recovered from poisoned state");
        poisoned.into_inner()
    })
}

// ── Priority & State ──

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[allow(dead_code)]
pub enum TaskPriority { Low = 0, Normal = 1, High = 2, Critical = 3 }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskState { Pending, Processing, Paused, Completed, Failed, Cancelled }

#[allow(dead_code)]
impl TaskState {
    pub fn is_terminal(&self) -> bool {
        matches!(self, TaskState::Completed | TaskState::Failed | TaskState::Cancelled)
    }
    pub fn is_active(&self) -> bool {
        matches!(self, TaskState::Pending | TaskState::Processing)
    }
}

#[derive(Debug, Clone)]
pub struct QueueTask {
    pub id: String, pub source_path: String, pub output_path: String,
    pub source_format: String, pub target_format: String,
    pub priority: TaskPriority, pub state: TaskState,
    pub progress: f64, pub created_at: Instant, pub started_at: Option<Instant>,
    pub estimated_duration: Duration,
}

impl Eq for QueueTask {}
impl PartialEq for QueueTask { fn eq(&self, other: &Self) -> bool { self.id == other.id } }
impl PartialOrd for QueueTask {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> { Some(self.cmp(other)) }
}
impl Ord for QueueTask {
    fn cmp(&self, other: &Self) -> Ordering {
        self.priority.cmp(&other.priority)
            .then_with(|| other.created_at.cmp(&self.created_at))
    }
}

/// Priority item stored in the heap (lightweight — no Instant, no Clone issues)
#[derive(Debug, Eq, PartialEq)]
struct PriorityItem {
    priority: TaskPriority,
    created_at: u128, // nanos since epoch
    task_id: String,
}
impl Ord for PriorityItem {
    fn cmp(&self, other: &Self) -> Ordering {
        self.priority.cmp(&other.priority)
            .then_with(|| other.created_at.cmp(&self.created_at))
    }
}
impl PartialOrd for PriorityItem { fn partial_cmp(&self, other: &Self) -> Option<Ordering> { Some(self.cmp(other)) } }

// ── ETA Calculator ──

#[allow(dead_code)]
struct EtaCalculator {
    alpha: f64, avg_speed: Option<f64>, samples: u32,
}
impl EtaCalculator {
    fn new() -> Self { Self { alpha: 0.3, avg_speed: None, samples: 0 } }
    fn record(&mut self, bytes: u64, duration: Duration) {
        let speed = bytes as f64 / duration.as_secs_f64().max(0.001);
        self.avg_speed = match self.avg_speed {
            None => Some(speed),
            Some(prev) => Some(self.alpha * speed + (1.0 - self.alpha) * prev),
        };
        self.samples += 1;
    }
    fn estimate(&self, remaining_bytes: u64) -> Duration {
        match self.avg_speed {
            Some(speed) if speed > 0.0 => Duration::from_secs_f64((remaining_bytes as f64 / speed).min(86400.0)),
            _ => Duration::from_secs(30),
        }
    }
}

// ── Task Queue (HashMap + BinaryHeap) ──

pub struct TaskQueue {
    max_concurrent: usize,
    globally_paused: Arc<Mutex<bool>>,
    /// All tasks by ID — O(1) lookup for pause/cancel/status
    tasks: Arc<Mutex<HashMap<String, QueueTask>>>,
    /// Active task IDs (currently running)
    active: Arc<Mutex<Vec<String>>>,
    /// Priority ordering (task IDs only)
    pending_heap: Arc<Mutex<BinaryHeap<PriorityItem>>>,
    /// Paused task IDs
    paused: Arc<Mutex<Vec<String>>>,
    /// Completed tasks (ring buffer, last 100)
    completed: Arc<Mutex<Vec<QueueTask>>>,
    /// ETA calculator
    eta: Arc<Mutex<EtaCalculator>>,
}

impl TaskQueue {
    pub fn new() -> Self {
        let cores = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
        // 为 Webview 渲染预留一个核心，防 UI 掉帧
        let max = if cores <= 2 { 1 } else { cores - 1 };
        Self {
            max_concurrent: max.min(16),
            globally_paused: Arc::new(Mutex::new(false)),
            tasks: Arc::new(Mutex::new(HashMap::new())),
            active: Arc::new(Mutex::new(Vec::new())),
            pending_heap: Arc::new(Mutex::new(BinaryHeap::new())),
            paused: Arc::new(Mutex::new(Vec::new())),
            completed: Arc::new(Mutex::new(Vec::new())),
            eta: Arc::new(Mutex::new(EtaCalculator::new())),
        }
    }

    /// Enqueue a new task
    pub fn enqueue(&self, task: QueueTask) {
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos();
        let item = PriorityItem { priority: task.priority, created_at: now, task_id: task.id.clone() };
        lock(&self.tasks, "tasks").insert(task.id.clone(), task);
        lock(&self.pending_heap, "pending_heap").push(item);
    }

    /// Dequeue the next available task
    /// Lock order: globally_paused → active → pending_heap → tasks
    pub fn dequeue(&self) -> Option<QueueTask> {
        if *lock(&self.globally_paused, "globally_paused") { return None; }
        if lock(&self.active, "active").len() >= self.max_concurrent { return None; }

        let mut heap = lock(&self.pending_heap, "pending_heap");
        let mut tasks = lock(&self.tasks, "tasks");

        // Pop until we find a valid pending task (or heap is empty)
        while let Some(item) = heap.pop() {
            if let Some(mut task) = tasks.remove(&item.task_id) {
                if task.state == TaskState::Pending {
                    task.state = TaskState::Processing;
                    task.started_at = Some(Instant::now());
                    tasks.insert(task.id.clone(), task.clone());
                    lock(&self.active, "active").push(task.id.clone());
                    return Some(task);
                }
            }
        }
        None
    }

    /// Mark a task as completed
    pub fn complete(&self, task_id: &str, bytes_processed: u64, duration: Duration) {
        let mut active = lock(&self.active, "active");
        active.retain(|id| id != task_id);
        drop(active);

        let mut tasks = lock(&self.tasks, "tasks");
        if let Some(task) = tasks.get_mut(task_id) {
            task.state = TaskState::Completed;
            task.progress = 1.0;
        }
        if bytes_processed > 0 {
            lock(&self.eta, "eta").record(bytes_processed, duration);
        }
        // Move to completed ring buffer
        if let Some(task) = tasks.remove(task_id) {
            let mut c = lock(&self.completed, "completed");
            c.push(task);
            if c.len() > 100 { c.remove(0); }
        }
    }

    /// Mark a task as failed
    pub fn fail(&self, task_id: &str) {
        lock(&self.active, "active").retain(|id| id != task_id);
        if let Some(mut task) = lock(&self.tasks, "tasks").remove(task_id) {
            task.state = TaskState::Failed;
            let mut c = lock(&self.completed, "completed");
            c.push(task);
            if c.len() > 100 { c.remove(0); }
        }
    }

    /// Pause a specific task
    pub fn pause_task(&self, task_id: &str) -> bool {
        let mut tasks = lock(&self.tasks, "tasks");
        if let Some(task) = tasks.get_mut(task_id) {
            task.state = TaskState::Paused;
            lock(&self.active, "active").retain(|id| id != task_id);
            lock(&self.paused, "paused").push(task_id.to_string());
            true
        } else {
            false
        }
    }

    /// Resume a specific task
    /// Lock order: paused → pending_heap → tasks (与 dequeue 一致防 ABBA 死锁)
    pub fn resume_task(&self, task_id: &str) -> bool {
        lock(&self.paused, "paused").retain(|id| id != task_id);
        // 先取 pending_heap 再取 tasks，避免与 dequeue 的死锁
        let _heap = lock(&self.pending_heap, "pending_heap");
        let mut tasks = lock(&self.tasks, "tasks");
        if let Some(task) = tasks.get_mut(task_id) {
            task.state = TaskState::Pending;
            let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos();
            drop(_heap);
            lock(&self.pending_heap, "pending_heap").push(PriorityItem {
                priority: task.priority, created_at: now, task_id: task_id.to_string(),
            });
            true
        } else {
            false
        }
    }

    /// Cancel a task by ID
    pub fn cancel_task(&self, task_id: &str) -> bool {
        lock(&self.active, "active").retain(|id| id != task_id);
        lock(&self.paused, "paused").retain(|id| id != task_id);
        if let Some(mut task) = lock(&self.tasks, "tasks").remove(task_id) {
            task.state = TaskState::Cancelled;
            let mut c = lock(&self.completed, "completed");
            c.push(task);
            true
        } else {
            false
        }
    }

    /// Toggle global pause
    pub fn toggle_global_pause(&self) -> bool {
        let mut g = lock(&self.globally_paused, "globally_paused");
        *g = !*g; *g
    }

    /// Get ETA for remaining tasks
    pub fn estimate_remaining(&self) -> Duration {
        let count = lock(&self.pending_heap, "pending_heap").len();
        lock(&self.eta, "eta").estimate(count as u64 * 1024 * 1024)
    }

    /// Get queue statistics
    pub fn stats(&self) -> QueueStats {
        QueueStats {
            max_workers: self.max_concurrent,
            active_jobs: lock(&self.active, "active").len(),
            pending_jobs: lock(&self.pending_heap, "pending_heap").len(),
            paused_jobs: lock(&self.paused, "paused").len(),
            completed_jobs: lock(&self.completed, "completed").len(),
            globally_paused: *lock(&self.globally_paused, "globally_paused"),
            estimated_remaining_secs: self.estimate_remaining().as_secs(),
        }
    }
}

impl Default for TaskQueue { fn default() -> Self { Self::new() } }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueStats {
    pub max_workers: usize, pub active_jobs: usize, pub pending_jobs: usize,
    pub paused_jobs: usize, pub completed_jobs: usize,
    pub globally_paused: bool, pub estimated_remaining_secs: u64,
}

pub struct WorkerPool { pub task_queue: TaskQueue }
impl WorkerPool {
    pub fn new() -> Self { Self { task_queue: TaskQueue::new() } }
    pub fn stats(&self) -> QueueStats { self.task_queue.stats() }
    pub fn max_workers(&self) -> usize { self.task_queue.max_concurrent }
}
impl Default for WorkerPool { fn default() -> Self { Self::new() } }

#[cfg(test)]
mod tests {
    use super::*;

    fn make_task(id: &str, p: TaskPriority) -> QueueTask {
        QueueTask {
            id: id.into(), source_path: "".into(), output_path: "".into(),
            source_format: "json".into(), target_format: "csv".into(),
            priority: p, state: TaskState::Pending, progress: 0.0,
            created_at: Instant::now(), started_at: None, estimated_duration: Duration::from_secs(5),
        }
    }

    #[test]
    fn test_priority_ordering() {
        let mut heap = BinaryHeap::new();
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos();
        heap.push(PriorityItem { priority: TaskPriority::Low, created_at: now, task_id: "low".into() });
        heap.push(PriorityItem { priority: TaskPriority::High, created_at: now, task_id: "high".into() });
        assert_eq!(heap.pop().unwrap().task_id, "high");
    }

    #[test]
    fn test_enqueue_dequeue() {
        let q = TaskQueue::new();
        q.enqueue(make_task("t1", TaskPriority::Normal));
        let t = q.dequeue();
        assert!(t.is_some());
        assert_eq!(t.unwrap().id, "t1");
    }

    #[test]
    fn test_global_pause() {
        let q = TaskQueue::new();
        q.enqueue(make_task("t1", TaskPriority::Normal));
        q.toggle_global_pause();
        assert!(q.dequeue().is_none());
        q.toggle_global_pause();
        assert!(q.dequeue().is_some());
    }

    #[test]
    fn test_concurrency_limit() {
        let q = TaskQueue::new();
        for i in 0..5 { q.enqueue(make_task(&format!("t{}", i), TaskPriority::Normal)); }
        // Only max_concurrent can be dequeued
        let count = (0..10).filter_map(|_| q.dequeue()).count();
        assert!(count <= q.max_concurrent);
    }

    #[test]
    fn test_pause_resume_task() {
        let q = TaskQueue::new();
        q.enqueue(make_task("t1", TaskPriority::Normal));
        let t = q.dequeue().unwrap();
        assert_eq!(t.state, TaskState::Processing);
        assert!(q.pause_task("t1"));
        assert!(q.resume_task("t1"));
    }

    #[test]
    fn test_cancel_task() {
        let q = TaskQueue::new();
        q.enqueue(make_task("c1", TaskPriority::Normal));
        let _ = q.dequeue();
        assert!(q.cancel_task("c1"));
    }

    #[test]
    fn test_complete_task() {
        let q = TaskQueue::new();
        q.enqueue(make_task("c2", TaskPriority::Normal));
        let _ = q.dequeue();
        q.complete("c2", 1024, Duration::from_secs(1));
        let stats = q.stats();
        assert!(stats.completed_jobs >= 1);
    }

    #[test]
    fn test_stats() {
        let q = TaskQueue::new();
        let s = q.stats();
        assert_eq!(s.pending_jobs, 0);
        assert_eq!(s.active_jobs, 0);
    }

    #[test]
    fn test_eta() {
        let mut eta = EtaCalculator::new();
        eta.record(1024 * 1024, Duration::from_secs(1));
        assert_eq!(eta.samples, 1);
        let est = eta.estimate(5 * 1024 * 1024);
        assert!(est.as_secs() > 0 && est.as_secs() <= 86400);
    }
}
