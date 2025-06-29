type Data = {
  input: string

  // state
  state: typeof State[keyof typeof State]
  code: number
  char: string
  tag: any
  attrName: string
  attrQuote: number

  // pos
  index: number
  start: number
  end: number

  // json
  stack: any[]
  doc: any
}

const State = {
  Text: 'Text',

  // tag
  BeforeTagName: 'BeforeTagName',
  InTagName: 'InTagName',
  BeforeClosingTagName: 'BeforeClosingTagName',
  InClosingTagName: 'InClosingTagName',
  AfterClosingTagName: 'AfterClosingTagName',

  // attr
  BeforeAttrName: 'BeforeAttrName',
  InAttrName: 'InAttrName',
  BeforeAttrValue: 'BeforeAttrValue',
  InAttrValue: 'InAttrValue',
}

const CharCodes = {
  // tag wrapper
  Lt:  0x3c, // "<"
  Slash: 0x2f, // "/"
  Gt: 0x3e, // ">"

  // attr
  Eq: 0x3d, // "="
  DoubleQuote: 0x22, // '"'
  SingleQuote: 0x27, // "'"

  // tag name
  // LowerA: 0x61, // "a"
  // LowerZ: 0x7a, // "z"
  // UpperA: 0x41, // "A"
  // UpperZ: 0x5a, // "Z"
  // Zero: 0x30, // "0"
  // Nine: 0x39, // "9"
  // Hyphen: 0x2d, // "-"

  // whitespace
  Space: 0x20, // " "
  Tab: 0x9, // "\t"
  NewLine: 0xa, // "\n"
  CarriageReturn: 0xd, // "\r"
  FormFeed: 0xc, // "\f"
  VerticalTab: 0xb, // "\v"
}

export const SelfClosingTags: Record<string, boolean> = {
  'area': true,
  'base': true,
  'br': true,
  'col': true,
  'embed': true,
  'hr': true,
  'img': true,
  'input': true,
  'link': true,
  'meta': true,
  'param': true,
  'source': true,
  'track': true,
  'wbr': true
}

/**
 * @see https://wx7vyvopbx.feishu.cn/docx/ST7add9rtohkcVxz11gcUFvxnUh?from=from_copylink
 */
export const parseHTML = (input: string) => {
  const d: Data = reset()
  d.input = input

  while (d.index < d.input.length) {
    d.code = d.input.charCodeAt(d.index)
    d.char = d.input[d.index]

    switch (d.state) {
      case State.Text: {
        stateText(d)
        break
      }
      case State.BeforeTagName: {
        stateBeforeTagName(d)
        break
      }
      case State.InTagName: {
        stateInTagName(d)
        break
      }
      case State.BeforeClosingTagName: {
        stateBeforeClosingTagName(d)
        break
      }
      case State.InClosingTagName: {
        stateInClosingTagName(d)
        break
      }
      case State.BeforeAttrName: {
        stateBeforeAttrName(d)
        break
      }
      case State.InAttrName: {
        stateInAttrName(d)
        break
      }
      case State.BeforeAttrValue: {
        stateBeforeAttrValue(d)
        break
      }
      case State.InAttrValue: {
        stateInAttrValue(d)
        break
      }
    }

    d.index += 1
  }

  finalize(d)

  return d
}

const reset = () : Data => {
  const doc = {type: 'doc'}
  return {
    input: '',

    // state
    state: State.Text,
    code: 0,
    char: '',
    tag: null,
    attrName: '',
    attrQuote: 0,

    // pos
    index: 0,
    start: 0,
    end: 0,

    // json
    stack: [doc],
    doc
  }
}

const stateText = (d: Data) => {
  if (d.code === CharCodes.Lt) {
    elementText(d)

    d.state = State.BeforeTagName
    d.start = d.index
  }
}

const stateBeforeTagName = (d: Data) => {
  if (d.code === CharCodes.Slash) {
    d.state = State.BeforeClosingTagName

  } else if (!isWhitespace(d.code)) {
    d.state = State.InTagName
    d.start = d.index
  }
}

const stateInTagName = (d: Data) => {
  // 不带属性的标签
  if (d.code === CharCodes.Gt) {
    tagName(d)
    elementStart(d)

    d.state = State.Text
    d.start = d.index + 1

  // 前面 content 内有 < 号（如 <p> 1 < 2 </p>）
  } else if (d.code === CharCodes.Lt) {
    backwardTo(d, CharCodes.Lt)

  // 自闭合标签
  } else if (d.code === CharCodes.Slash) {
    tagName(d)
    elementStart(d)

    d.state = State.InClosingTagName

  // 可能带属性的标签
  } else if (isWhitespace(d.code)) {
    // elementStart(d)

    // d.state = State.BeforeAttrName
    // d.start = d.index + 1
  }
}

const stateBeforeClosingTagName = (d: Data) => {
  d.state = State.InClosingTagName
  d.start = d.index
}

const stateInClosingTagName = (d: Data) => {
  if (d.code === CharCodes.Gt) {
    elementEnd(d)

    d.state = State.Text
    d.start = d.index + 1
  }
}

const stateBeforeAttrName = (d: Data) => {
  if (d.code === CharCodes.Gt) {
    d.state = State.Text
    d.start = d.index + 1

  // 前面 content 内有 < 号（如 <p> 1 < 2 </p>）
  } else if (d.code === CharCodes.Lt) {
    backwardTo(d, CharCodes.Lt)

  } else if (!isWhitespace(d.code)) {
    d.state = State.InAttrName
    d.start = d.index
  }
}

const stateInAttrName = (d: Data) => {
  if (d.code === CharCodes.Eq) {
    // 属性名转为小写
    d.attrName = d.input.slice(d.start, d.index).toLowerCase().trim()

    d.state = State.BeforeAttrValue
    d.start = d.index + 1
  }
}

const stateBeforeAttrValue = (d: Data) => {
  // 引号
  if (d.code === CharCodes.DoubleQuote || d.code === CharCodes.SingleQuote) {
    d.attrQuote = d.code
    d.state = State.InAttrValue
    d.start = d.index + 1

  // 无引号
  } else if (!isWhitespace(d.code)) {
    d.attrQuote = 0
    d.state = State.InAttrValue
    d.start = d.index
  }
}

const stateInAttrValue = (d: Data) => {
  // 有引号时，直接去找对应的结尾引号
  if (d.attrQuote) {
    if (d.code === d.attrQuote) {
      elementAttr(d)

      d.state = State.BeforeAttrName
      d.start = d.index + 1
    }

  } else if (isWhitespace(d.code)) {
    elementAttr(d)

    d.state = State.BeforeAttrName
    d.start = d.index + 1

  } else if (d.code === CharCodes.Gt) {
    elementAttr(d)

    d.state = State.Text
    d.start = d.index + 1
  }
}

const finalize = (d: Data) => {
  if (d.state === State.Text) {
    elementText(d)
  }
}

const isWhitespace = (c: number): boolean => {
    return (
      c === CharCodes.Space ||
      c === CharCodes.Tab ||
      c === CharCodes.NewLine ||
      c === CharCodes.CarriageReturn ||
      c === CharCodes.FormFeed ||
      c === CharCodes.VerticalTab
    )
}

const backwardTo = (d: Data, c: number) => {
  let index = d.index

  while (index > 0) {
    index -= 1
    if (d.input.charCodeAt(index) === c) break
  }

  if (index) {
    d.start = index
    console.log( d.start, d.index)

    console.log(d.input.slice(d.start, d.index))
    stateText(d)
  }
}

const tagName = (d: Data) => {
  const tagName = d.input.slice(d.start, d.index).toLowerCase().trim().replace(/\/$/, '')
  const isComment = tagName.startsWith('!--') && tagName.endsWith('--')

  if (isComment) {
    d.tag = null
    return
  }

  d.tag = {type: tagName}
}

const elementStart = (d: Data) => {
  // parent node
  const node = d.stack[d.stack.length - 1]

  if (!node.content) node.content = []
  node.content.push(d.tag)
  d.stack.push(d.tag)
  console.log('====elementStart', d.tag)
}

const elementAttr = (d: Data) => {
  const attrName = d.attrName
  const attrValue = d.input.slice(d.start, d.index).trim()
  console.log('====elementAttr', attrName, attrValue)

  const node = d.stack[d.stack.length - 1]
  if (!node.attrs) node.attrs = {}

  // todo: 解码 attrValue
  node.attrs[attrName] = attrValue
}

const elementEnd = (d: Data) => {
  console.log('====elementEnd')
  const tagName = d.input.slice(d.start, d.index).toLowerCase().trim()
  const node = d.stack[d.stack.length - 1]

  console.log('tagName', tagName)

  if (node.type === tagName) d.stack.pop()
}

const elementText = (d: Data) => {
  if (d.index > d.start) {
    const text = d.input.slice(d.start, d.index)

    console.log('====elementText', text)

    const parentNode = d.stack[d.stack.length - 1]
    if (parentNode) {
      if (!parentNode.content) parentNode.content = []
      const lastChild = parentNode.content[parentNode.content.length - 1]

      if (lastChild?.type === 'text') {
        lastChild.text += text
      } else {
        parentNode.content.push({type: 'text', text})
      }
    }
  }
}

setTimeout(() => {
  // const d = parseHTML(`<p> 1 < 2 </p>` )
  const d = parseHTML(`<br`)

  console.log(d.state)
  console.log(d.start, d.index)
  console.log(d.input.slice(d.start, d.index))
  console.log(d.tag)
  console.log(d.attrName)
  console.log(d.attrQuote)
  console.log(d.stack[d.stack.length - 1])
  console.log(d.doc)
})

