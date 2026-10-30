// MPE / python-markdown admonitions: `!!! type "Title"` (or `???` / `???+` for collapsible),
// body indented by 4 spaces, ending at the first less-indented non-blank line.
const START = /^(!!!|\?\?\?\+?)[ \t]+([\w-]+)(?:[ \t]+(?:"(.*)"|(.*?)))?[ \t]*$/

export default function admonition(md) {
  md.block.ruler.before('fence', 'admonition', (state, startLine, endLine, silent) => {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false
    const line = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine])
    const m = START.exec(line)
    if (!m) return false
    if (silent) return true

    let end = startLine + 1
    for (let next = end; next < endLine; next++) {
      if (state.isEmpty(next)) continue
      if (state.sCount[next] - state.blkIndent < 4) break
      end = next + 1 // last indented line; trailing blanks stay outside
    }

    const [, marker, type, quoted, bare] = m
    const collapsible = marker !== '!!!'
    const title = quoted ?? (bare || type[0].toUpperCase() + type.slice(1))
    const tag = collapsible ? 'details' : 'div'

    let t = state.push('admonition_open', tag, 1)
    t.attrSet('class', `admonition ${type.toLowerCase()}`)
    if (marker === '???+') t.attrSet('open', '')
    t.map = [startLine, end]
    if (title) {
      state.push('admonition_title_open', collapsible ? 'summary' : 'p', 1).attrSet('class', 'admonition-title')
      t = state.push('inline', '', 0)
      t.content = title
      t.map = [startLine, startLine + 1]
      t.children = []
      state.push('admonition_title_close', collapsible ? 'summary' : 'p', -1)
    }

    const { blkIndent, lineMax, parentType } = state
    state.blkIndent += 4
    state.lineMax = end
    state.parentType = 'admonition'
    state.md.block.tokenize(state, startLine + 1, end)
    state.blkIndent = blkIndent
    state.lineMax = lineMax
    state.parentType = parentType

    state.push('admonition_close', tag, -1)
    state.line = end
    return true
  })
}
