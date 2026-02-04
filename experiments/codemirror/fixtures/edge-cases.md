# Edge Cases

## Asterisks that should NOT be formatting

Equation: 5 * 3 * 2 = 30

File path: /path/to/file*

Glob pattern: *.txt

Mid-word asterisks: foo*bar*baz

## Underscores that should NOT be formatting

Variable name: my_variable_name

snake_case_identifier

file_name_with_underscores.txt

## Empty markers (invalid)

Empty bold: ****

Empty italic: **

## Adjacent formatting

**bold1****bold2**

*italic1**italic2*

## Punctuation adjacent

**bold**, followed by comma.

"**quoted bold**"

(**bold in parens**)

## Unicode content

**日本語** in bold

*émphasis* with accents
