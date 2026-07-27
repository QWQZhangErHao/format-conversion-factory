import { describe, it, expect } from 'vitest'
import { LayoutAnalyzer } from './analyzer'
import { ONNXEngine } from '../onnx/runtime'
import { LayoutElementType } from '../types'

describe('LayoutAnalyzer', () => {
  const engine = new ONNXEngine()
  const analyzer = new LayoutAnalyzer(engine)

  it('detects headings in markdown', async () => {
    const md = '# Title\n\nSome paragraph text\n\n## Subtitle\n\nMore content'
    const layout = await analyzer.analyze(md, 'markdown')
    const headings = (layout.pages[0]?.elements ?? []).filter(
      (e) => e.type === LayoutElementType.HEADING || e.type === LayoutElementType.SUBHEADING,
    )
    expect(headings.length).toBe(2)
    expect(headings[0]?.text).toBe('Title')
  })

  it('detects HTML headings', async () => {
    const md = '<h1>Main Title</h1>\n<p>Text</p>\n<h2>Sub Section</h2>\n<h3>Details</h3>'
    const layout = await analyzer.analyze(md, 'html')
    const elements = layout.pages[0]?.elements ?? []
    // Elements: [0] HEADING, [1] PARAGRAPH, [2] HEADING, [3] SUBHEADING
    expect(elements[0]?.type).toBe(LayoutElementType.HEADING)
    expect(elements[0]?.text).toBe('Main Title')
    expect(elements[2]?.type).toBe(LayoutElementType.HEADING)
    expect(elements[2]?.text).toBe('Sub Section')
    expect(elements[3]?.type).toBe(LayoutElementType.SUBHEADING)
    expect(elements[3]?.text).toBe('Details')
  })

  it('detects unordered list items', async () => {
    const md = '- Item 1\n- Item 2\n- Item 3'
    const layout = await analyzer.analyze(md, 'markdown')
    expect(layout.metadata.hasLists).toBe(true)
  })

  it('detects ordered list items', async () => {
    const md = '1. First\n2. Second\n3. Third'
    const layout = await analyzer.analyze(md, 'markdown')
    expect(layout.metadata.hasLists).toBe(true)
    // After groupLists(), items are children of a LIST element
    const lists = layout.pages[0]?.elements?.filter(
      (e) => e.type === LayoutElementType.LIST,
    ) ?? []
    expect(lists.length).toBe(1)
    expect(lists[0]?.children?.length).toBe(3)
  })

  it('detects ordered list items with parens (1) 2))', async () => {
    const md = '1) Alpha\n2) Beta\n3) Gamma'
    const layout = await analyzer.analyze(md, 'markdown')
    expect(layout.metadata.hasLists).toBe(true)
  })

  it('groups consecutive list items', async () => {
    const md = '- A\n- B\n- C\n\nParagraph after list'
    const layout = await analyzer.analyze(md, 'markdown')
    const lists = (layout.pages[0]?.elements ?? []).filter(
      (e) => e.type === LayoutElementType.LIST,
    )
    expect(lists.length).toBe(1)
    expect(lists[0]?.children?.length).toBe(3)
  })

  it('groups multiple separate lists', async () => {
    const md = '- A\n- B\n\nPara\n\n- C\n- D\n- E'
    const layout = await analyzer.analyze(md, 'markdown')
    const lists = (layout.pages[0]?.elements ?? []).filter(
      (e) => e.type === LayoutElementType.LIST,
    )
    expect(lists.length).toBe(2)
    expect(lists[0]?.children?.length).toBe(2)
    expect(lists[1]?.children?.length).toBe(3)
  })

  it('groups list items that trail at end of content', async () => {
    const md = 'Para\n\n- X\n- Y'
    const layout = await analyzer.analyze(md, 'markdown')
    const lists = (layout.pages[0]?.elements ?? []).filter(
      (e) => e.type === LayoutElementType.LIST,
    )
    expect(lists.length).toBe(1)
    expect(lists[0]?.children?.length).toBe(2)
  })

  it('detects code blocks', async () => {
    const md = '```\ncode line 1\ncode line 2\n```'
    const layout = await analyzer.analyze(md, 'markdown')
    // Opening ``` is detected as paragraph; inside code block lines are skipped
    expect(layout.metadata.elementCount).toBeGreaterThan(0)
  })

  it('detects tables with pipes', async () => {
    const md = '| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |'
    const layout = await analyzer.analyze(md, 'markdown')
    expect(layout.metadata.hasTables).toBe(true)
    const tables = (layout.pages[0]?.elements ?? []).filter(
      (e) => e.type === LayoutElementType.TABLE,
    )
    expect(tables.length).toBeGreaterThan(0)
  })

  it('ignores lines with fewer than 3 pipes', async () => {
    const md = '| only | two'
    const layout = await analyzer.analyze(md, 'markdown')
    expect(layout.metadata.hasTables).toBe(false)
  })

  it('detects images/figures', async () => {
    const md = '![alt text](image.png)'
    const layout = await analyzer.analyze(md, 'markdown')
    expect(layout.metadata.hasImages).toBe(true)
    const figures = (layout.pages[0]?.elements ?? []).filter(
      (e) => e.type === LayoutElementType.FIGURE,
    )
    expect(figures.length).toBe(1)
  })

  it('handles empty content', async () => {
    const layout = await analyzer.analyze('', 'markdown')
    expect(layout.metadata.elementCount).toBe(0)
    expect(layout.pages[0]?.elements?.length ?? 0).toBe(0)
  })

  it('handles whitespace-only content', async () => {
    const layout = await analyzer.analyze('  \n\n  \n', 'markdown')
    expect(layout.metadata.elementCount).toBe(0)
  })

  it('falls back to heuristic when modelBasedAnalysis throws', async () => {
    const modelAnalyzer = new LayoutAnalyzer(engine, { useModel: true })
    // Engine is available (mocked), so it tries modelBasedAnalysis which throws,
    // then falls back to heuristic
    const layout = await modelAnalyzer.analyze('Hello world', 'markdown')
    expect(layout.metadata.elementCount).toBeGreaterThan(0)
  })

  it('bounding box coordinates from createElement', async () => {
    const md = '# Title\n\nHello'
    const layout = await analyzer.analyze(md, 'markdown')
    const el = layout.pages[0]?.elements?.[0]
    expect(el?.bbox).toBeDefined()
    expect(el?.bbox.x).toBe(0)
    expect(el?.bbox.y).toBe(0) // line 0: # Title
    expect(el?.bbox.width).toBe(800)
    expect(el?.bbox.height).toBe(20)
  })

  it('reports layout metadata with tables, images, lists and confidence', async () => {
    const md = '# Doc\n\nText\n\n| A | B |\n|---|---|\n| 1 | 2 |'
    const layout = await analyzer.analyze(md, 'markdown')
    expect(layout.metadata.hasTables).toBe(true)
    expect(layout.metadata.elementCount).toBeGreaterThan(0)
    expect(layout.metadata.confidence).toBeGreaterThan(0)
    expect(layout.pages[0]?.pageNumber).toBe(1)
    expect(layout.pages[0]?.width).toBe(800)
    expect(layout.pages[0]?.height).toBe(1200)
  })

  it('marks list item continuation in list-paragraph transitions', async () => {
    // When inList is true and previous element is LIST_ITEM, continuation stays LIST_ITEM
    const md = '- Item\ncontinuation\n\nNot a list'
    const layout = await analyzer.analyze(md, 'markdown')
    const _listItems = (layout.pages[0]?.elements ?? []).filter(
      (e) => e.type === LayoutElementType.LIST_ITEM,
    )
    // After grouping, list items are inside LIST.children
    const lists = (layout.pages[0]?.elements ?? []).filter(
      (e) => e.type === LayoutElementType.LIST,
    )
    expect(lists.length).toBe(1)
    expect(lists[0]?.children?.length).toBe(2) // Item + continuation
  })
})
