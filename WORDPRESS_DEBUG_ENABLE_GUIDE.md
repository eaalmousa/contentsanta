# WordPress Debug Logging - Quick Setup

**Problem**: WP_DEBUG_LOG is disabled, so we can't see plugin errors.

---

## How to Enable Debug Logging

### Step 1: Edit wp-config.php

**Location**: `/home/customer/www/gulfestategazette.com/public_html/wp-config.php`

**Find these lines** (around line 80):
```php
define( 'WP_DEBUG', false );
```

**Replace with**:
```php
// Enable debugging
define( 'WP_DEBUG', true );

// Log errors to debug.log (don't display on screen)
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );
@ini_set( 'display_errors', 0 );

// For Content Santa debugging
define( 'WP_DEBUG_CONTENT_SANTA', true );
```

### Step 2: Save File

### Step 3: Trigger Plugin Again

Go to: **Settings → Content Santa Connector**  
Click: **"Run Now (Manual Pull)"**

### Step 4: Check Debug Log

**Location**: `/wp-content/debug.log`

Download and check the last 50 lines for Content Santa errors.

---

## Alternative: Temporary Debug (No File Edit)

If you can't edit wp-config.php, add this to **Code Snippets**:

```php
// Temporary Content Santa debugging
add_action('init', function() {
    if (isset($_GET['cs_debug'])) {
        ini_set('display_errors', 1);
        error_reporting(E_ALL);
    }
});
```

Then visit: `https://gulfestategazette.com/?cs_debug=1` and click "Run Now"

---

## What We're Looking For

Once debug is enabled, we'll see errors like:

```
[15-Feb-2026 22:00:00 UTC] Content Santa: Processing job abc123
[15-Feb-2026 22:00:01 UTC] Content Santa: ERROR - Category ID 1 does not exist
[15-Feb-2026 22:00:01 UTC] Content Santa: Failed to create post
```

This will tell us EXACTLY why posts aren't being created!
