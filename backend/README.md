# Backend design notes

How to run the backend is in the [main README](../README.md). This file explains three
design decisions in the foundation: how passwords are stored, how login works with
JWT, and how the tables relate. The tender analysis is explained separately in
[app/ai/README.md](app/ai/README.md).

## 1. Passwords: why bcrypt, and why salting

The database never holds a password, only a **hash** of it (`users.hashed_password`).
A hash is a one-way function: easy to compute from the password, and no way back.
At login, `verify_password()` in `app/core/security.py` hashes what the user typed and
compares it with the stored hash.

The point is to limit the damage if the database is ever stolen, through a backup, an
SQL injection, or a leaked laptop. People reuse passwords, so stolen plain passwords
would open their email and bank accounts as well. With hashes, the attacker has to
guess each password and hash every guess to test it.

**Why salting.** A salt is a random value created for each password and hashed
together with it. Without salts:

- two users with the same password would have the same hash, so cracking one cracks
  both, and the attacker can see who shares a password;
- an attacker could use a **rainbow table**: a huge list of hashes of common passwords,
  computed once and reused against every leaked database.

With a different salt per user, the same password gives a different hash every time,
so each password has to be attacked on its own and precomputed tables are useless.
The salt is not secret. bcrypt stores it inside the hash string:

```
$2b$12$R9h/cIPz0gi.URNNX3kh2O PST9/PgBkqquzi.Ss7KIUgO2t0jWMUW
 |   |  |                      |
 |   |  22-character salt      the hash itself
 |   cost: 2^12 rounds
 algorithm version (bcrypt)
```

`bcrypt.gensalt()` makes a new salt for every call to `hash_password()`.

**Why bcrypt rather than SHA-256.** General-purpose hashes like SHA-256 are designed
to be fast. A graphics card can try billions of SHA-256 guesses per second, which
makes guessing passwords easy. bcrypt is a password hash: it is deliberately slow, and
its **cost factor** sets how slow. We use the default of 12, about a quarter of a second
per hash. A user logging in never notices, but an attacker can only try a few guesses
per second for each hash instead of billions. The cost can be raised as computers get
faster, and old hashes keep working because each one records its own cost.

Two details in this code:

- **The 72-byte limit.** bcrypt only uses the first 72 bytes of a password. Instead of
  silently ignoring the rest, registration rejects longer passwords
  (`MAX_PASSWORD_BYTES`).
- **Logins take the same time either way.** When the email is unknown, `login()` still
  checks the password against a dummy hash. Without that, an unknown email would get
  an answer noticeably faster, and an attacker could time responses to find out which
  emails have accounts. The same message, "Invalid email or password", is returned in
  both cases for the same reason.

Passwords are never logged, and a failed registration never sends the password back:
`app/api/errors.py` rewrites validation errors so they do not echo the input.

## 2. How JWT login works, and the trade-offs against sessions

**The flow:**

1. `POST /api/auth/login` checks the email and password and returns an
   `access_token`.
2. The frontend sends it with every request: `Authorization: Bearer <token>`.
3. On each protected route, `get_current_user` in `app/api/deps.py` checks the token,
   reads the user id from it, loads that user, and passes them to the route. A missing,
   tampered or expired token gets `401`.

**What a JWT is.** A JSON Web Token is three base64url parts joined by dots:
`header.payload.signature`.

- **header:** `{"alg": "HS256", "typ": "JWT"}`
- **payload (the "claims"):** `{"sub": "42", "iat": 1763190000, "exp": 1763193600}`. The
  user id, when it was issued, and when it expires (60 minutes later, from
  `ACCESS_TOKEN_EXPIRE_MINUTES`).
- **signature:** HMAC-SHA256 of the header and payload, using `JWT_SECRET` from `.env`.

Anyone can read the payload, because it is only encoded, not encrypted. But nobody can
change it without the secret: change `sub` from 42 to 43 and the signature no longer
matches, so the server rejects it. The server therefore trusts the token without
keeping any record of having issued it. That makes a JWT **stateless**.

`decode_access_token()` requires both `exp` and `sub` and checks the signature and the
expiry. The settings refuse to start without a `JWT_SECRET` of at least 32 characters,
and refuse the example secret when `ENVIRONMENT=production`.

**Sessions, the alternative.** With server-side sessions, login creates a random
session id, stores it in a sessions table (or Redis) with the user id, and gives it to
the browser in a cookie. Each request looks up the id in that table.

| | JWT (what we use) | Server-side sessions |
| --- | --- | --- |
| Server stores | nothing per login | one row per logged-in session |
| Log out / revoke | **not possible before expiry**: the token stays valid until `exp` | delete the row; takes effect immediately |
| Several servers | any server with the secret can check a token | every server needs the shared session store |
| Mobile apps, other clients | easy: send a header | needs cookie handling |
| If the secret leaks | attacker can create a token for **any** user | no equivalent single secret |
| Data in the token | readable by anyone holding it; put nothing private in it | stays on the server |
| CSRF | not an issue with a header | cookies need CSRF protection |
| Stealing via XSS | possible if stored where JS can read it (see the frontend README) | not possible with an httpOnly cookie |

The main weakness of JWT is revocation. "Log out" only deletes the token in the
browser, and a stolen token works until it expires. That is why the expiry is short
(60 minutes). The usual fixes, if needed later:

- short access tokens plus a refresh token that is stored, and can be revoked, on the
  server;
- a `token_version` column on `users`, put in the token and compared on each request,
  so "log out everywhere" just increments it.

One deliberate compromise: `get_current_user` still loads the user from the database
on every request, so a deleted account stops working straight away. So we do one
database read per request anyway. What JWT saves us is the sessions table and managing
it.

For this project JWT fits. The frontend is a separate single-page app that talks to an
API, there is no session store to run, and the short expiry keeps the revocation risk
small.

## 3. How the tables are related, and why

```
firms ──< users                 a firm has many users
  │
  ├──── company_profiles        a firm has exactly one profile   (firm_id UNIQUE)
  ├───< past_contracts          a firm has many past contracts
  └───< tenders ──< conditions ──< eligibility_results
```

(`──<` means one-to-many.)

**The firm is the centre, not the user.** The one who bids on a tender, holds the
licence, and has the turnover and past contracts is the firm. A person only acts for
it. So all business data hangs off `firm_id`. If a second employee of the same firm
registers later, they see the same profile and tenders, because nothing is tied to the
person. `users.firm_id` is many-to-one for the same reason.

**Every query is filtered by `firm_id`.** That is how "a user can only see and change
their own firm's data" is enforced. Each route takes the firm id from the logged-in
user, never from the request body, and adds `WHERE firm_id = ...` to every query. A
contract or tender belonging to another firm is answered with `404`, as if it did not
exist. `firm_id` is indexed on every table, so those filters stay fast.

**The profile is a separate table, one-to-one.** The profile fields could have been
columns on `firms`, but a separate table keeps the identity data (`firms`, `users`),
which login depends on, apart from the business data that is edited often and filled in
a bit at a time. `company_profiles.firm_id` is `UNIQUE`, so the database itself
guarantees one profile per firm. Registration creates the firm and its empty profile
in the same transaction.

**Past contracts are their own table, one-to-many.** A firm has any number of
contracts, and each has its own title, client, value, type and year. Storing them as a
list in one column would break first normal form: the database could not check each
value, and the matcher could not ask "how many contracts of at least 150 lakh since
2021?" with a query. One row per contract makes adding and deleting a single contract
simple, and lets the database enforce `value` and `year` as real columns.

**The analysis chain follows the same idea.** A tender belongs to one firm, a condition
to one tender, and an eligibility result to one condition. Each step records where the
next one came from, so every verdict in the report can be traced back to a clause on a
page of a specific uploaded document.

**What happens on delete:**

- Deleting a firm deletes its profile, contracts and tenders (`ON DELETE CASCADE`).
  Without the firm they mean nothing.
- Deleting a tender deletes its conditions and results the same way.
- `users.firm_id` uses `ON DELETE SET NULL` instead, so deleting a firm does not delete
  the people's login accounts. A user without a firm gets `403` on the firm routes.

**Other constraints the database enforces itself:**

- `users.email` is `UNIQUE`. Registration checks for a duplicate first, to return a
  friendly `409`, but two requests arriving at the same moment could both pass that
  check. The unique index is what actually prevents a duplicate, and the resulting
  `IntegrityError` is turned into the same `409`.
- Money is `NUMERIC(18, 2)`, never a float, so amounts are exact. 0.1 + 0.2 is 0.3 here.
- `users.role` (default `"user"`) leaves room for an admin role later without changing
  the table.
