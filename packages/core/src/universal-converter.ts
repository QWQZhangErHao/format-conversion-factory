/**
 * Universal Format Converter — 任意格式 → 任意格式
 *
 * 策略:
 * 1. 若支持浏览器内转换 → 直接使用
 * 2. 自动检测源格式，解析为结构化中间表示 (IR)
 * 3. 从 IR 渲染为任意目标格式
 */

import { convertInBrowser, isBrowserConvertible } from './browser-converter'

// ── 格式检测 ──

type DetectedFormat = 'json'|'csv'|'yaml'|'xml'|'toml'|'markdown'|'html'|'txt'|'sql'|'tsv'|'ini'|'unknown'

function detectFormatFromContent(content: string): DetectedFormat {
  const t = content.trim()
  if (!t) return 'txt'
  if (t.startsWith('{')||t.startsWith('[')) { try { JSON.parse(t); return 'json' } catch {} }
  if (t.match(/^<\?xml/)) return 'xml'
  if (t.match(/^<(html|!DOCTYPE)/i)) return 'html'
  if (t.includes('<html')||t.includes('<!DOCTYPE')) return 'html'
  if (t.includes(': ')&&!t.includes('{')&&t.split('\n')[0]?.match(/^\w[\w-]*: \S/)) return 'yaml'
  if (t.startsWith('[')&&t.match(/^\[[\w.]+\]$/m)) return 'toml'
  if (t.match(/^(SELECT|INSERT|CREATE)\s/i)) return 'sql'
  if (t.includes('\t')&&t.split('\n')[0]?.includes('\t')) return 'tsv'
  if (t.includes(',')&&(t.split('\n')[0]?.split(',')?.length??0)>1) return 'csv'
  if (t.match(/^#{1,6}\s/m)||t.match(/\[[^\]]+\]\([^)]+\)/)||t.match(/^[-*+]\s/m)) return 'markdown'
  return 'txt'
}

// ── 中间表示 (IR) ──

interface IRNode {
  type: 'heading'|'paragraph'|'list'|'code'|'table'|'keyvalue'|'raw'
  level?: number; value?: string; items?: string[]; lines?: string[]
  headers?: string[]; rows?: string[][]
}

function parseToIR(content: string, fmt: string): IRNode[] {
  const nodes: IRNode[] = []
  const f = fmt === 'unknown' ? detectFormatFromContent(content) : fmt
  switch (f) {
    case 'json': { try { nodes.push({type:'code',lines:[JSON.stringify(JSON.parse(content),null,2)]}) } catch { nodes.push({type:'raw',lines:content.split('\n')}) } break }
    case 'csv': { const l=content.split('\n').filter(Boolean); if(l.length){const h=l[0]!.split(',').map(s=>s.trim());const r=l.slice(1).map(l=>l.split(',').map(s=>s.trim()));nodes.push({type:'table',headers:h,rows:r})} break }
    case 'yaml': case 'toml': case 'ini': case 'xml': nodes.push({type:'code',lines:content.split('\n')}); break
    case 'sql': { nodes.push({type:'code',lines:content.split('\n')}); break }
    case 'markdown': case 'html': { for(const line of content.split('\n')){const m=line.match(/^(#{1,6})\s+(.+)/);if(m){nodes.push({type:'heading',level:m[1]!.length,value:m[2]!.trim()})}else if(line.match(/^[-*+]\s+/)){const last=nodes[nodes.length-1];if(last?.type==='list'){if(!last.items)last.items=[];last.items.push(line.replace(/^[-*+]\s+/,''))}else nodes.push({type:'list',items:[line.replace(/^[-*+]\s+/,'')]})}else if(line.trim()){nodes.push({type:'paragraph',value:line.trim()})}} break }
    default: nodes.push({type:'raw',lines:content.split('\n')})
  }
  return nodes
}

function renderIR(nodes: IRNode[], target: string): string {
  const out: string[] = []
  switch (target) {
    case 'json': { const headings:Record<string,string[]>={}; const paragraphs:string[]=[]; const lists:string[][]=[]; let table:{h?:string[];r?:string[][]}|undefined; let code:string|undefined; let text:string|undefined; for(const n of nodes){switch(n.type){case 'heading':{const k='h'+n.level;if(!headings[k])headings[k]=[];headings[k]!.push(n.value??'');break}case 'paragraph':paragraphs.push(n.value??'');break;case 'list':lists.push(n.items??[]);break;case 'table':table={h:n.headers,r:n.rows};break;case 'code':code=n.lines?.join('\n');break;default:text=n.lines?.join('\n')}} const j:Record<string,unknown>={}; for(const[k,v]of Object.entries(headings))j[k]=v; if(paragraphs.length)j.paragraphs=paragraphs; if(lists.length)j.lists=lists; if(table)j.table=table; if(code)j.code=code; if(text)j.text=text; return JSON.stringify(j,null,2) }
    case 'csv': { const escapeCsv=(v:string)=>v.includes(',')||v.includes('"')||v.includes('\n')?`"${v.replace(/"/g,'""')}"`:v; const rows:string[][]=[]; for(const n of nodes){if(n.type==='heading')rows.push(['h'+n.level,n.value??'']);else if(n.type==='paragraph')rows.push(['text',n.value??'']);else if(n.type==='list')n.items?.forEach(i=>rows.push(['item',i]));else if(n.type==='table'&&n.headers){rows.push(n.headers);n.rows?.forEach(r=>rows.push(r))}else if(n.type==='code'||n.type==='raw')n.lines?.forEach(l=>rows.push(['text',l]))} return rows.map(r=>r.map(escapeCsv).join(',')).join('\n') }
    case 'yaml': { for(const n of nodes){switch(n.type){case 'heading':out.push(`${'  '.repeat((n.level??1)-1)}heading:${' '.repeat(n.level??1)}${n.value}`);break;case 'paragraph':out.push(`text: "${n.value}"`);break;case 'list':out.push('items:',...(n.items?.map(i=>`  - ${i}`)??[]));break;case 'code':out.push('content: |',...(n.lines?.map(l=>`  ${l}`)??[]));break;case 'table':out.push('table:');n.headers&&out.push(`  headers: [${n.headers.join(',')}]`);n.rows?.forEach(r=>out.push(`  - [${r.join(',')}]`));break;case 'raw':out.push(...(n.lines??[]))}} return out.join('\n') }
    case 'md': case 'markdown': { for(const n of nodes){switch(n.type){case 'heading':out.push(`${'#'.repeat(n.level??1)} ${n.value}`);break;case 'paragraph':out.push(n.value??'');break;case 'list':out.push(...(n.items?.map(i=>`- ${i}`)??[]));break;case 'code':out.push('```',...(n.lines??[]),'```');break;case 'table':out.push(`|${n.headers?.join('|')}|`,`|${n.headers?.map(()=>'---').join('|')}|`,...(n.rows?.map(r=>`|${r.join('|')}|`)??[]));break;case 'raw':out.push(...(n.lines??[]))}out.push('')} return out.join('\n') }
    case 'html': { for(const n of nodes){switch(n.type){case 'heading':out.push(`<h${n.level??1}>${n.value}</h${n.level??1}>`);break;case 'paragraph':out.push(`<p>${n.value}</p>`);break;case 'list':out.push('<ul>',...(n.items?.map(i=>`<li>${i}</li>`)??[]),'</ul>');break;case 'code':out.push('<pre><code>',...(n.lines??[]),'</code></pre>');break;case 'table':out.push('<table>');n.headers&&out.push(`<tr>${n.headers.map(h=>`<th>${h}</th>`).join('')}</tr>`);n.rows?.forEach(r=>out.push(`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`));out.push('</table>');break;case 'raw':out.push(...(n.lines??[]))}} return out.join('\n') }
    case 'xml': { out.push('<?xml version="1.0"?>','<root>');for(const n of nodes){switch(n.type){case 'heading':out.push(`<h level="${n.level}">${n.value}</h>`);break;case 'paragraph':out.push(`<p>${n.value}</p>`);break;case 'list':out.push('<list>',...(n.items?.map(i=>`<item>${i}</item>`)??[]),'</list>');break;case 'code':out.push('<code>',...(n.lines??[]),'</code>');break;case 'raw':out.push(...(n.lines??[]))}} out.push('</root>');return out.join('\n') }
    case 'toml': { for(const n of nodes){switch(n.type){case 'heading':out.push(`\n[heading_${n.level}]\nvalue="${n.value}"`);break;case 'paragraph':out.push(`\n[text]\ncontent="${n.value}"`);break;case 'list':out.push(`\n[items]\nvalues=[${n.items?.map(i=>`"${i}"`).join(',')}]`);break;case 'code':out.push(`\n[code]\ncontent="""\n${n.lines?.join('\n')}\n"""`);break;case 'raw':out.push(`\n[content]\ntext="""\n${n.lines?.join('\n')}\n"""`)}} return out.join('\n') }
    case 'sql': { out.push('-- Converted by UCF');for(const n of nodes){switch(n.type){case 'heading':out.push(`INSERT INTO headings(level,text)VALUES(${n.level},'${n.value?.replace(/'/g,"''")}');`);break;case 'paragraph':out.push(`INSERT INTO content(text)VALUES('${n.value?.replace(/'/g,"''")}');`);break;case 'list':n.items?.forEach(i=>out.push(`INSERT INTO items(value)VALUES('${i.replace(/'/g,"''")}');`));break;case 'raw':out.push(`--${n.lines?.join('\n--')}`)}} return out.join('\n') }
    case 'tsv': { const escapeTsv=(v:string)=>v.includes('\t')||v.includes('\n')?`"${v.replace(/"/g,'""')}"`:v; const rows:string[][]=[];for(const n of nodes){if(n.type==='heading')rows.push(['heading',String(n.level??''),n.value??'']);else if(n.type==='paragraph')rows.push(['text',n.value??'']);else if(n.type==='list')n.items?.forEach(i=>rows.push(['item',i]));else if(n.type==='table')n.headers&&rows.push(n.headers),n.rows?.forEach(r=>rows.push(r));else if(n.type==='code'||n.type==='raw')n.lines?.forEach(l=>rows.push(['text',l]))} return rows.map(r=>r.map(escapeTsv).join('\t')).join('\n') }
    default: { for(const n of nodes){switch(n.type){case 'heading':out.push(`${'#'.repeat(n.level??1)}${n.value}`);break;case 'paragraph':out.push(n.value??'');break;case 'list':out.push(...(n.items?.map(i=>`-${i}`)??[]));break;case 'code':out.push(...(n.lines??[]));break;default:out.push(...(n.lines??[]))}} return out.join('\n') }
  }
}

export function universalConvert(content: string, sourceFormat: string, targetFormat: string): string {
  try { if (isBrowserConvertible(sourceFormat, targetFormat)) return convertInBrowser(content, sourceFormat, targetFormat) } catch (e) { console.warn('[UCF] 浏览器转换失败，降级到 IR 路径:', e) }
  const actual = sourceFormat === 'unknown' ? detectFormatFromContent(content) : sourceFormat
  try { if (actual !== sourceFormat && isBrowserConvertible(actual, targetFormat)) return convertInBrowser(content, actual, targetFormat) } catch (e) { console.warn('[UCF] 浏览器转换(二次检测)失败，降级到 IR 路径:', e) }
  const ir = parseToIR(content, actual)
  return renderIR(ir, targetFormat)
}

export const UNIVERSAL_CONVERSIONS: Record<string, string[]> = {
  json: ['csv','yaml','toml','xml','md','html','sql','tsv','txt'],
  csv: ['json','yaml','xml','md','html','sql','tsv','txt'],
  yaml: ['json','csv','toml','xml','md','html','txt'],
  xml: ['json','csv','yaml','toml','md','html','txt'],
  toml: ['json','csv','yaml','xml','md','html','txt'],
  md: ['json','csv','yaml','html','xml','toml','sql','tsv','txt'],
  markdown: ['json','csv','yaml','html','xml','toml','sql','tsv','txt'],
  html: ['json','csv','yaml','md','xml','sql','txt'],
  txt: ['json','csv','yaml','md','html','xml','toml','sql','tsv'],
  sql: ['json','csv','yaml','md','html','txt'],
  tsv: ['json','csv','yaml','md','html','txt'],
  ini: ['json','yaml','toml','txt'],
  unknown: ['json','csv','yaml','md','html','xml','toml','sql','tsv','txt'],
}
