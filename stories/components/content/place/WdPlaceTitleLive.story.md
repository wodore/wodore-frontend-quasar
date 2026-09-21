# WdPlaceTitle (Live)

Loads the actual `WdPlaceTitle` component with real backend data.

## How it works

- Component calls `usePlace(slug)` composable
- Composable fetches data from backend API
- Component renders with real data (name, URL, weather)

## Requirements

- Backend must be running at the configured API URL
- The slug must exist in the database
- Network connectivity required

## Testing error states

Use the **Custom Slug** control to enter an invalid slug and see error handling.

- **Invalid slug:** Enter "nonexistent-place"
- **Backend down:** Stop your backend server
- **Network issues:** Disconnect internet
- **Slow connection:** Throttle network in DevTools
