# Style guide

Adopted from [djc/oxish `CONTRIBUTING.md`](https://github.com/djc/oxish/blob/main/CONTRIBUTING.md#style-guide).

## Ordering

**Top-down within modules.** Items depend on items defined *below* them, not above. The
public API sits near the top, since it is read and changed most. This is the opposite of
the bottom-up ordering habitual in Python. `const` values therefore go at the bottom
(least complex, fewest dependencies) — though in a large module a `const` may sit directly
below its single user. `#[cfg(test)] mod tests {}` goes at the very bottom. Module
declarations (`mod foo;`) come after imports but before other items, and imports from
local modules stay close to the declaration. A file with substantial code in inline
modules should not also carry much code outside them.

**For a given type**, order: (1) the `struct`/`enum` definition, (2) the inherent `impl`,
(3) trait `impl`s from most specific to least specific — `Debug`/`Clone` last.

**Within an inherent `impl`**: associated functions (no `self`) → constructors, fewest
arguments first → public `&mut self` → public `&self` → private `&mut self` → private
`&self` → `const` values. Top-down ordering also applies; where the two conflict, use
judgement. Getters and setters mirror field order in the type definition.

**Attributes**: docs first, then the attributes that most affect meaning last. Write
`derive`d traits alphabetically.

```rust
/// Doc comment always first
#[cfg(feature-gates)]
#[allow(lint-configuration)]
#[non_exhaustive]
#[derive(Clone, Debug)]
pub struct Foo;
```

## Functions

- **Avoid short single-use functions.** They force the reader to jump around. Inline
  unless the algorithm is complex enough to warrant a name and interface.
- **Avoid free-standing functions.** If the semantics depend strongly on one argument
  whose type is local to this crate, make it a method. Several arguments that always
  originate from one common type is a strong signal to do the same.
- **Order arguments most specific to least specific** — the specific ones differentiate
  this function from others, so they establish context fastest.
- **Use `impl ...`** for argument and return types when the type is used once; generic
  bounds add indirection that is harder to read in one pass.
- **No type elision in fully qualified calls**: write `CertificateChain::default()`, not
  `<_>::default()`.
- **Parse, don't validate.** Avoid `validate`/`check` functions that inspect a populated
  object; use the type system so invalid states cannot be represented.
- **Error handling**: `Result` pervasively. Outside tests, avoid `unwrap()`/`expect()`
  unless a local invariant makes it safe — and then add a comment explaining how the
  invariant is upheld.

## Expressions

- **Avoid single-use bindings.** Lean on the expression-oriented nature of Rust; prefer
  `map` and other combinators over `for` loops. Minimise mutable bindings per scope. But
  clarity wins: `.map().map_err()` where both arms transform significantly is often worse
  than a `match`.
- **Early `return`/`continue`** to fight rightward drift.
- **Hoist common returns** out of `match`/`if` arms:

```rust
// Incorrect:
match foo {
    1..10 => Ok(do_one_thing()),
    _ => Ok(do_another()),
}

// Correct:
Ok(match foo {
    1..10 => do_one_thing(),
    _ => do_another(),
})
```

- **Avoid `ref` in patterns.** Take a reference on the scrutinee instead; since match
  ergonomics landed, `ref` is unidiomatic.

## Naming

- **Concise, but expand unfamiliar abbreviations**: `key_usage` not `ku`, `anonymous` not
  `anon`. Very common short forms like `url` are fine.
- **No type suffixes** on variables when the type is unambiguous. `_id` remains acceptable
  for numeric entity IDs.
- **No `get_` prefixes**, per the Rust API guidelines.
- **Enum variants alphabetical**, unless mirroring an external source's order. Prefer
  active verbs (`Allow` over `Allowed`, `Forbid` over `Forbidden`) and avoid faux-bools
  like `Yes`/`No` — name the states.
- **Don't elide generic lifetimes**: always write the `<'_>` placeholder.

## Imports

Three blocks: (1) `std`, (2) external crates, (3) crate-internal. Within a block, split
imports that don't share a parent module:

```rust
// Incorrect
use alloc::{format, vec::Vec};

// Correct
use alloc::format;
use alloc::vec::Vec;
```

Reference types by imported symbol name rather than qualified path. Exception: overly
generic or easily confused names — then import under an alias (`use std::error::Error as
StdError`) or use a one-level qualified path.

Note the tension with this crate's rules: `leptos::html` is deliberately imported as a
module and called qualified (`html::div()`), because the bare element names would collide
with everything.

## Comments

Descriptive doc comments on items. Wrap **all** comments — doc or otherwise — to 100
columns, and follow [Appendix A of RFC 1574](https://rust-lang.github.io/rfcs/1574-more-api-documentation-conventions.html#appendix-a-full-conventions-text).

Nothing in this crate is publicly exposed, so doc comments are a judgement call rather
than a requirement — but the 100-column wrap is not.

## Misc

- **Numeric literals**: pick a base that fits the domain (hex for protocol constants,
  octal for UNIX modes) and group digits: `100_000_000`, not `100000000`.
- **Avoid type aliases** — they obfuscate the underlying type without adding safety. Use
  the newtype idiom when an abstraction boundary earns its complexity.
  
  This collides head-on with the builder API, which produces types like
  `HtmlElement<Div, (Class<&str>,), (Text, HtmlElement<A, ..>)>`. Resolve it by returning
  `impl IntoView` from view functions rather than naming or aliasing those types.
- **Type exhaustiveness**: public enums get either `#[non_exhaustive]` or
  `#[allow(clippy::exhaustive_enums)]`; the latter only when the enum is complete by
  definition (`enum CoinFlip { Heads, Tails }`). Err toward `#[non_exhaustive]`. Same for
  structs, except that a struct with at least one private field needs no marking.

## Commit history

- Small commits that do one thing
- Don't mix refactoring with functional changes
- Mechanical changes (renames, moves) get their own commit
- Isolate `Cargo.lock` updates in their own commits
- Keep formatting-only commits separate from functional ones
- Don't reference issue or PR numbers in commit messages

