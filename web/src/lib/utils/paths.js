// lastSegment is the last part of a filesystem path, split on / and \ (Windows).
export const lastSegment = (p) => p.split(/[\\/]/).pop()
