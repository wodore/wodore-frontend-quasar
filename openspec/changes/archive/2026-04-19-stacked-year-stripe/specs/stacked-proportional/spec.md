## ADDED Requirements

### Requirement: Single rectangle with multi-color stripes

When `stacked` is true, each month cell SHALL be a single rectangle. The rectangle SHALL display diagonal (-45deg) stripes where each type/category row gets its own stripe color. The stripe thickness for each color SHALL be proportional to that type's percentage value.

#### Scenario: Two types at 70% and 30%

- **WHEN** row 1 has value 70 with color "#346751" and row 2 has value 30 with color "#e8a838" for a given month, and `stacked` is true
- **THEN** the cell renders as one rectangle with diagonal stripes where the first color's stripes are ~2.3x thicker than the second color's stripes

#### Scenario: Three types with different values

- **WHEN** three rows have values 40, 35, 25 for a given month and `stacked` is true
- **THEN** the cell renders as one rectangle with three stripe colors, each proportional to its value

### Requirement: Solid fill when one type is 100%

When any single type has a value of 100 (or more) and all other types are undefined or 0, the cell SHALL render as a solid fill of that type's color with no stripe pattern.

#### Scenario: First type at 100%

- **WHEN** row 1 has value 100 and all other rows have undefined or 0 for a given month, and `stacked` is true
- **THEN** the cell renders as a solid rectangle filled with row 1's color

#### Scenario: Second type at 100%

- **WHEN** row 2 has value 100 and row 1 has value 0 or undefined, and `stacked` is true
- **THEN** the cell renders as a solid rectangle filled with row 2's color

### Requirement: Gray stripes for unknown remainder

When the sum of all defined type values for a month is less than 100, the remaining percentage SHALL be rendered as gray diagonal stripes (#e0e0e0) within the same stripe pattern.

#### Scenario: Values sum to 50%

- **WHEN** row 1 has value 30 and row 2 has value 20 for a given month (sum = 50), and `stacked` is true
- **THEN** the cell stripe pattern includes type 1 stripes (proportional to 30%), type 2 stripes (proportional to 20%), and gray stripes (proportional to the remaining 50%)

#### Scenario: All values are undefined

- **WHEN** all rows have `undefined` for a given month and `stacked` is true
- **THEN** the cell renders with the existing "unknown" crosshatch pattern (unchanged behavior)

### Requirement: Normalization when sum exceeds 100%

When the sum of all defined type values for a month exceeds 100, the values SHALL be proportionally normalized so the total equals 100% for stripe calculation purposes.

#### Scenario: Values sum to 150%

- **WHEN** rows have values 60, 50, 40 for a given month (sum = 150) and `stacked` is true
- **THEN** values are normalized to 40%, 33%, 27% respectively for stripe thickness calculation, filling the entire rectangle with colored stripes (no gray remainder)
