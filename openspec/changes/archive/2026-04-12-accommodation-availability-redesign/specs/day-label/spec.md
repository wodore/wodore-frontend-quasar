## ADDED Requirements

### Requirement: Display contextual day name

WdDayLabel SHALL display a contextual day name based on the provided date relative to today:

- "Heute" for today
- "Morgen" for tomorrow
- "Gestern" for yesterday
- Weekday abbreviation (e.g., "Mo", "Di") for all other dates

The component SHALL use `$q.lang.isoName` for locale-aware formatting.

#### Scenario: Today's date

- **WHEN** the `date` prop matches today's date
- **THEN** the day name displays "Heute"

#### Scenario: Tomorrow's date

- **WHEN** the `date` prop matches tomorrow's date
- **THEN** the day name displays "Morgen"

#### Scenario: Yesterday's date

- **WHEN** the `date` prop matches yesterday's date
- **THEN** the day name displays "Gestern"

#### Scenario: Future weekday

- **WHEN** the `date` prop is a date beyond tomorrow
- **THEN** the day name displays the short weekday abbreviation for that date

### Requirement: Display formatted date

WdDayLabel SHALL display the date in DD.MM. format (e.g., "12.04.").

#### Scenario: Date formatting

- **WHEN** the `date` prop is "2026-04-12"
- **THEN** the date displays "12.04."

### Requirement: Active state styling

WdDayLabel SHALL render the day name in bold when the `isActive` prop is true, and in normal weight when false or omitted.

#### Scenario: Active day label

- **WHEN** `isActive` is true
- **THEN** the day name text is bold

#### Scenario: Inactive day label

- **WHEN** `isActive` is false or omitted
- **THEN** the day name text is normal weight

### Requirement: No background styling

WdDayLabel SHALL NOT apply any background styling. Consumers of the component are responsible for their own background handling.

#### Scenario: No background applied

- **WHEN** WdDayLabel renders
- **THEN** no background color or opacity is applied to the component
