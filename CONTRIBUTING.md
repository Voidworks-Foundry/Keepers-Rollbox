# Contributing to Keeper's Rollbox

Thanks for helping. Bug reports, fixes and ideas are all welcome. Contributions are accepted under the project's [MIT licence](LICENSE).

## Report a bug

Open an [issue](https://github.com/Voidworks-Foundry/keepers-rollbox/issues) and copy this into it:

```
**What I did**
(The tokens selected, the menu, what you picked, which button you clicked.)

**What I expected**

**What happened**
(A screenshot helps. Did the player see the request? Did CoC7's card appear?)

**Console**
(Press F12, open Console, and paste any red lines, especially ones starting with keepers-rollbox |)

**Versions**
- Keeper's Rollbox:
- Foundry VTT (version and build):
- CoC7 system:
- Other modules active (or "none"; does it still happen with only Rollbox and CoC7 on?):
```

If the problem is in the roll or the card itself (the result, Luck, pushing, Sanity loss), it may be CoC7's: Rollbox only sends CoC7's own requests. Report it anyway and we'll say which it is.

## Propose a change

1. **Talk first for anything new.** For a new feature or a change to how a menu behaves, open an issue describing it before writing code. Rollbox has a deliberate scope: it only sends CoC7's own requests and never changes how CoC7 or Foundry behave ([AGENTS.md](AGENTS.md), "The rules that matter"). Small bug fixes can go straight to a pull request.
2. **Fork** the repository and **make a branch** for your change (`fix-sanity-label`, not `main`).
3. **Make the change** the way [AGENTS.md](AGENTS.md) says: find your task in its "Find your way" table, read what it lists, change the code, update the part's document, add a test for each changed behaviour (and its row in [docs/TESTS.md](docs/TESTS.md)), and add a line to `CHANGELOG.md`. The [recipes](docs/recipes/) cover common changes step by step.
4. **Run the checks** (below) until they pass.
5. **Open a pull request** that says what changed for the Keeper and the players, which tests you added, and what you tried in Foundry (and what you couldn't).

## The checks that must pass

```
npm ci
npm test
npm run release-check
```

GitHub runs the same three on every pull request (`.github/workflows/ci.yml`). `release-check` builds the release zip and checks it holds only `module.json` and `scripts/`, that every file is there, and that no `console.log` or `debugger` is left in.

## AI-assisted contributions

Rollbox itself is developed with AI coding agents, so contributions made with an AI tool are welcome, from any tool, as long as they follow [AGENTS.md](AGENTS.md). If your tool expects a different file name, rename or copy `AGENTS.md` to that name, or tell it to read `AGENTS.md` first. Its "Find your way" table says which few documents and tests each kind of task needs.

You are responsible for what you submit: read the change yourself, make sure the checks pass, and try it in Foundry where you can. It helps to say in the pull request which tool you used.
