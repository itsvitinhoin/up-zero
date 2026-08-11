type IssuePathPart = string | number

type ValidationIssueLike = {
  path?: IssuePathPart[]
  message?: unknown
}

type ValidationErrorLike = {
  issues?: ValidationIssueLike[]
  errors?: ValidationIssueLike[]
  message?: unknown
}

type ValidationErrorFormatOptions = {
  fallbackMessage?: string
  topLevelLabels?: Record<string, string>
  nestedLabels?: Record<string, string>
}

function extractValidationIssues(error: ValidationErrorLike | null | undefined): ValidationIssueLike[] {
  if (!error) return []
  if (Array.isArray(error.issues)) return error.issues
  if (Array.isArray(error.errors)) return error.errors
  return []
}

function formatIssuePath(path: IssuePathPart[], nestedLabels?: Record<string, string>): string {
  if (!Array.isArray(path) || path.length === 0) return ''

  return path
    .map((part) => {
      if (typeof part === 'number') {
        return `[${part}]`
      }

      const key = String(part)
      return nestedLabels?.[key] || key
    })
    .join('.')
    .replace(/\.\[/g, '[')
}

export function getValidationErrorMessage(
  validationError: unknown,
  options: ValidationErrorFormatOptions = {},
): string {
  const {
    fallbackMessage = 'Dados inválidos',
    topLevelLabels = {},
    nestedLabels,
  } = options

  const normalizedError = validationError as ValidationErrorLike
  const issues = extractValidationIssues(normalizedError)
  const firstIssue = issues[0]

  if (!firstIssue) {
    const rawMessage = String(normalizedError?.message || '').trim()
    return rawMessage || fallbackMessage
  }

  const message = String(firstIssue.message || 'valor inválido').trim() || 'valor inválido'
  const path = Array.isArray(firstIssue.path) ? firstIssue.path : []
  const topLevelField = String(path[0] ?? '')
  const topLevelLabel = topLevelLabels[topLevelField]

  if (topLevelLabel) {
    return `${topLevelLabel}: ${message}`
  }

  const formattedPath = formatIssuePath(path, nestedLabels)
  if (formattedPath) {
    return `${formattedPath}: ${message}`
  }

  return message
}
