# Auth Screens Redesign — Login & Signup
**Date:** 2026-04-30  
**Scope:** `mobile-api/app/auth/login.tsx`, `mobile-api/app/auth/signup.tsx`, `mobile-api/app/_layout.tsx`

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Visual style | Dark Premium | Black bg, white card, minimal |
| Layout | Hero image top, card overlaps | Keeps meda.png, card slides over |
| Signup fields | First + Last (row), Email, Password, Confirm | Zero scroll, removes username/phone UI |
| Login identifier | Email (not username) | More intuitive; API already supports it |
| Typography | Inter Light 300 (body), Inter Regular 400 (buttons) | Replaces Bold/Serif combo; refined feel |
| Validation | Inline per-field (no Alert) | Less disruptive UX |

---

## Visual Layout (both screens)

```
┌─────────────────────────────┐
│  [meda.png hero — ~40% vh]  │  ← cover, dark gradient fade at bottom
│                             │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← #141414 card, borderRadius 22 top corners
│  Title                      │     overlaps image by 18px (marginTop: -18)
│  Subtitle                   │
│  [fields]                   │
│  [button]                   │
│  [footer link]              │
└─────────────────────────────┘
```

- `SafeAreaView` with `backgroundColor: #0A0A0A` — no white edges
- `KeyboardAvoidingView` wraps everything — form nudges up on keyboard open
- No `ScrollView` — everything fits on one screen

---

## Color Tokens

| Token | Value | Usage |
|---|---|---|
| `bg` | `#0A0A0A` | Screen background |
| `card` | `#141414` | Form card background |
| `inputBg` | `rgba(255,255,255,0.06)` | Input fill |
| `inputBorder` | `rgba(255,255,255,0.10)` | Input border (default) |
| `inputBorderFocus` | `rgba(255,255,255,0.30)` | Input border (focused) |
| `inputBorderError` | `#FF4444` | Input border (error) |
| `labelText` | `rgba(255,255,255,0.45)` | Field labels (ALL CAPS) |
| `placeholderText` | `rgba(255,255,255,0.22)` | Placeholder text |
| `bodyText` | `rgba(255,255,255,0.38)` | Subtitle / footer copy |
| `errorText` | `#FF5555` | Inline error message |
| `white` | `#FFFFFF` | Headings, button bg, links |

---

## Typography

Add `Inter_300Light` to `_layout.tsx` font loading.  
Remove `DMSerifDisplay` usage from both auth screens.

| Usage | Font | Size |
|---|---|---|
| Screen title ("Welcome back") | `Inter_300Light` | 26 |
| Screen subtitle | `Inter_300Light` | 13 |
| Field labels | `Inter_400Regular` | 11 (letter-spacing 1px) |
| Input text / placeholder | `Inter_300Light` | 15 |
| Button text | `Inter_400Regular` | 14 (letter-spacing 1.5px) |
| Footer / link text | `Inter_300Light` | 13 |
| Error messages | `Inter_400Regular` | 11 |

---

## Login Screen

### State
```ts
email: string
password: string
showPassword: boolean
loading: boolean
errors: { email: string | null; password: string | null }
```

### Fields
1. **EMAIL** label + TextInput (`keyboardType: email-address`, `autoCapitalize: none`, `autoCorrect: false`)
2. **PASSWORD** label + TextInput (`secureTextEntry: !showPassword`) + eye-icon toggle (Feather `eye` / `eye-off`)
3. **Forgot password?** — right-aligned pressable (navigates to `/auth/forgot-password` or shows coming-soon toast for now)

### Button
- Full-width minus 36px padding, height 52, `borderRadius: 14`
- White background, black `#0A0A0A` text
- Shows `ActivityIndicator` (black) while `loading`

### Footer
`"Don't have an account? Sign Up"` — centered, taps to `router.push('/auth/signup')`

### API call
```ts
authService.login({ email, password })
```
API already accepts `email` field — no service changes needed.

### Validation (inline, no Alert)
- On submit: if `email` empty → set `errors.email`; if `password` empty → set `errors.password`
- API error → single `Alert` (keeps existing pattern for network/server errors)
- Each TextInput: red border when its error is non-null; small error text below

---

## Signup Screen

### State
```ts
firstName: string
lastName: string
email: string
password: string
confirmPassword: string
showPassword: boolean
showConfirm: boolean
loading: boolean
errors: { firstName, lastName, email, password, confirmPassword } — each string | null
```

### Fields
1. **FIRST NAME** + **LAST NAME** — side-by-side row (`flex: 1` each, `gap: 10`)
2. **EMAIL** — `keyboardType: email-address`, `autoCapitalize: none`
3. **PASSWORD** — `secureTextEntry` + eye toggle
4. **CONFIRM PASSWORD** — `secureTextEntry` + eye toggle

### Button
Same style as Login. Label: "CREATE ACCOUNT"

### Footer
`"Already have an account? Sign In"` — taps to `router.push('/auth/login')`

### API call
Username is auto-derived from the email prefix (everything before `@`), lowercased and stripped of dots/symbols beyond what the backend tolerates. This is invisible to the user.

```ts
const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
authService.signup({
  full_names: `${firstName.trim()} ${lastName.trim()}`,
  username,
  email,
  password,
})
```

On success: navigate directly to `/(tabs)/home` (skip the "please log in" alert — the API returns a token on register).

### Validation (inline)
- firstName, lastName, email, password required
- password === confirmPassword
- password min 6 chars (show: "Password must be at least 6 characters")
- API error → Alert

---

## Image Treatment

- `meda.png` displayed with `resizeMode: cover`, height `screenHeight * 0.40`
- A `LinearGradient` overlay on the bottom 60px of the image fades `transparent → #141414`
- This creates the seamless card-emerging-from-image effect

---

## Font Loading Change (`_layout.tsx`)

```ts
import { Inter_300Light, Inter_400Regular, Inter_700Bold, useFonts } from "@expo-google-fonts/inter";

useFonts({
  Inter_300Light,   // ← add
  Inter_400Regular,
  Inter_700Bold,
  DMSerifDisplay_400Regular,  // keep — used elsewhere in app
})
```

---

## Files Changed

| File | Change |
|---|---|
| `app/_layout.tsx` | Add `Inter_300Light` to font loading |
| `app/auth/login.tsx` | Full rewrite with new design |
| `app/auth/signup.tsx` | Full rewrite with new design |

No changes to `services/auth.service.ts` — login already accepts `email`.
