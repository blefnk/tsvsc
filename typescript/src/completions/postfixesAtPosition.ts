import type tslib from 'typescript/lib/tsserverlibrary'
import { PostfixCompletion } from '../ipcTypes'
import { findChildContainingPosition, findClosestParent } from '../utils'
import { isAssignableToType, toSimpleType } from 'ts-simple-type'
import { join } from 'path'
import { newVirtualFileContents, virtualFileName } from '../overrideSourceFiles'

export default (position: number, fileName: string, scriptSnapshot: ts.IScriptSnapshot, languageService: ts.LanguageService): PostfixCompletion[] => {
    const { character } = languageService.toLineColumnOffset!(fileName, position)
    const startLinePos = position - character
    const textBeforePositionLine = scriptSnapshot?.getText(startLinePos, position + 1)
    const program = (languageService as ReturnType<typeof tsFull['createLanguageService']>).getProgram()!
    const sourceFile = program.getSourceFile(fileName)
    if (!textBeforePositionLine || !sourceFile) return []
    const dotIdx = textBeforePositionLine.lastIndexOf('.')
    if (dotIdx === -1) return []
    const nodePos = startLinePos + dotIdx - 1
    //@ts-ignore
    const node = findChildContainingPosition(ts, sourceFile, nodePos)
    if (!node) return []
    newVirtualFileContents('type A = number')
    //@ts-ignore
    const typeChecker = (program as import('unleashed-typescript').Program)!.getTypeChecker()
    const type = typeChecker.getTypeAtLocation(node)
    const sourceFile2 = program.getSourceFile(virtualFileName)!
    const node2 = findChildContainingPosition(ts, sourceFile2 as any, 5)
    const typeOriginal = typeChecker.getTypeAtLocation(node2!)
    const isGood = typeChecker.isTypeAssignableTo(type, typeOriginal)
    // const { statements } = ts.createSourceFile('temp.ts', 'type A = string', ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
    const postfixes: PostfixCompletion[] = []
    let foundNode: ts.Node | undefined
    if (
        ts.isIdentifier(node) &&
        (foundNode = findClosestParent(node, [ts.SyntaxKind.BinaryExpression, ts.SyntaxKind.IfStatement], [])) &&
        (!ts.isBinaryExpression(foundNode!) || !isComparingToken(foundNode.operatorToken))
    ) {
        if (ts.isIdentifier(node)) {
            postfixes.push(
                ...['undefined', 'null'].map((label): PostfixCompletion => {
                    return {
                        label,
                        insertText: ` === ${label}`,
                    }
                }),
            )
        }
        // hide after equality?
        postfixes.push({
            label: 'eq',
            insertText: ' === ',
        })
    }
    // if (ts.isBinaryExpression(node.parent?.parent)) {
    //     const binaryExprNode = node.parent.parent
    //     probablyAddNotSnippet(postfixes, binaryExprNode, ts)
    // }
    return postfixes
}

const isComparingToken = (node: ts.Node) => {
    switch (node.kind) {
        case ts.SyntaxKind.EqualsEqualsEqualsToken:
        case ts.SyntaxKind.EqualsEqualsToken:
        case ts.SyntaxKind.ExclamationEqualsToken:
        case ts.SyntaxKind.ExclamationEqualsEqualsToken:
        case ts.SyntaxKind.LessThanToken:
        case ts.SyntaxKind.LessThanEqualsToken:
        case ts.SyntaxKind.GreaterThanToken:
        case ts.SyntaxKind.GreaterThanEqualsToken:
            return true
    }
    return false
}

const probablyAddNotSnippet = (postfixes: PostfixCompletion[], binaryExprNode: ts.BinaryExpression, ts: typeof tslib) => {
    let replaceOperator: string | undefined
    switch (binaryExprNode.operatorToken as any) {
        case ts.SyntaxKind.EqualsEqualsEqualsToken:
            replaceOperator = '!=='
            break
        case ts.SyntaxKind.EqualsEqualsToken:
            replaceOperator = '!='
            break
        case ts.SyntaxKind.ExclamationEqualsToken:
            replaceOperator = '=='
            break
        case ts.SyntaxKind.ExclamationEqualsEqualsToken:
            replaceOperator = '==='
            break

        default:
            break
    }
    if (!replaceOperator) return
    postfixes.push({
        label: 'not',
        // TODO! refactor. don't include in other cases (>)
        insertText: `${binaryExprNode.left.getText()} ${replaceOperator} ${binaryExprNode.right.getText()}`,
        // replacement: [binaryExprNode.getStart()],
    })
}
