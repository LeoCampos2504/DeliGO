# DeliGO — Canonical report directory normalization audit

Audit date: 2026-09-27 (local workspace date)  
Mode: READ-ONLY inventory; this file is the only file created by this task.  
Scope: Git worktrees returned by `git worktree list --porcelain`, their report directories, canonical handoffs, and report-like Markdown outside `codex-reports`.

## Policy recorded by this audit

```text
REPORT_DIR_CANONICAL=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports
REPORT_LOCATION_POLICY=ALL_TECHNICAL_REPORTS_MUST_EXIST_IN_CANONICAL_REPORT_DIR_EVEN_IF_WORK_EXECUTES_FROM_ANOTHER_WORKTREE
WORKTREE_REPORT_DIR_IS_NOT_CANONICAL=SI
REPORT_OUTPUT_DIR=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports
MASTER_HANDOFF=C:\Leo Campos\Trabajo\deligo-main-limpio\CODEX_REPORT.md
FULL_CONTEXT=C:\Leo Campos\Trabajo\deligo-main-limpio\DELIGO_FULL_CONTEXT_LATEST.md
ROADMAP=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports\ROADMAP.md
```

This establishes the requested output/location rule; it does not itself move or remove existing files. Future reports should be written directly to the canonical directory, including when code work runs in another worktree. Git synchronization is a separate concern and must not recreate persistent physical copies in functional worktrees.

## Worktrees and working-tree state

`git worktree list --porcelain` returned five DeliGO worktrees:

| Worktree | HEAD | Branch | `codex-reports` |
|---|---|---|---|
| `C:\Leo Campos\Trabajo\deligo-main-limpio` (canonical) | `e1fee008d326b800cb311f5a65a391601c4dc1ab` | `work/p2-t43-r2` | Present; 516 Markdown files, 16,300,135 bytes |
| `C:\Leo Campos\Trabajo\deligo-t34-session-isolation` | `0421c9902a1c636149fa46a54d0ea1fbfb66308e` | `work/p2-t34-session-isolation` | Present; 77 files, 2,674,379 bytes |
| `C:\Leo Campos\Trabajo\deligo-t38-installation-ux` | `82ee16a27e71cd4d438c81f7953a4956a563389d` | `work/p2-t38-installation-ux` | Present; 76 files, 2,656,811 bytes |
| `C:\Leo Campos\Trabajo\deligo-t39-admin` | `cf46781ffc999024b19063a8ed9ab34a1557b92c` | `work/p2-t39-r3` | Present; 73 files, 2,642,933 bytes |
| `C:\Users\eltig\.codex\worktrees\p2-doc-reconcile-t38\deligo-main-limpio` | `33923c36e1bdab8dcc70dd66fc0d28524c9db790` | `codex/p2-doc-reconcile-before-t38` | Present; 73 files, 2,643,531 bytes |

All four noncanonical report directories are present. The canonical worktree has 34 tracked/modified status entries and 26,750 untracked entries; those pre-existing contents were left untouched. Each of the other four worktrees reported no modified or untracked files. No reset, stash, clean, code edit, or worktree mutation was performed.

## Comparison method and summary

Compared each `.md` file in each noncanonical `codex-reports` directory to the same relative path in the canonical directory. Content comparison normalized CRLF/CR to LF before exact comparison; SHA-256 was also used to fingerprint divergent files (raw hashes therefore differ for some line-ending-only copies). Timestamps were not used to decide authority or equivalence.

| Classification | Files | Interpretation / later handling |
|---|---:|---|
| `IDENTICAL_DUPLICATE` | 273 | Exact text after line-ending normalization. Candidate for later noncanonical-copy removal, only after operator-authorized normalization. |
| `CANONICAL_IS_SUPERSET_OR_NEWER` | 2 | Canonical text contains the worktree text. Preserve canonical; worktree copy is a later removal candidate. |
| `WORKTREE_IS_NEWER_OR_HAS_UNIQUE_CONTENT` | 24 | These are divergent in both directions: neither version contains the other. Do not remove; semantically reconcile first. “Newer” here means unique content, not a timestamp conclusion. |
| `ONLY_NON_CANONICAL` | 0 | No report in these four directories lacked a same-name canonical counterpart. |

Total noncanonical `codex-reports` Markdown copies: **299** (273 + 2 + 24). Files demonstrably safe to consider for later removal by content comparison: **275** (273 + 2), not removed in this audit. Files requiring consolidation/review: **24**. No noncanonical-only report was found.

### Exact divergent-file inventory

Every listed pair has unique content on both sides. `LOCAL_SHA256` is the raw worktree file hash; `CANONICAL_SHA256` is the raw same-name canonical file hash. An identical pair of hashes across different worktrees means those worktrees share that version; it does not make it equivalent to the canonical version.

| Worktree | Report | LOCAL_SHA256 | CANONICAL_SHA256 |
|---|---|---|---|
| T34 | `DECISIONS_AND_INVARIANTS.md` | `B86E573B8FDDB68637A5CE9D9933E6C011BA19DD5918BD5BE397ABC64FF9BD88` | `0373BEAE72121A111394DB2D22243E44F2EBE48E51CCA1C9F308F4E919DA8082` |
| T34 | `GIT_DEPLOY_HISTORY.md` | `2EA70A2A9F2BCE7CCB78B462361486F96A67BA8F88E6E0FC6C0A3BA05155BA9F` | `25BE5072A9633D22D6CA0599481983898C98EC71B417F0661934C51BEBA3A194` |
| T34 | `P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md` | `57D995C64FE06CEE3BAA4CDD3EEEBC8C9B9ABD6802407EE0BAE10971210935DC` | `DA99247BC33FDB6041647F676E0381E45B59CAACADDC7A662858BDA60C17041E` |
| T34 | `ROADMAP.md` | `155F3E233F8B1F6AF80D48306B6D06A4A89ADDE53EA889D095AA6BB5CD25877A` | `0F31DB75D495156500CF8CC437546A7C6F62DC0C9B998CD9179823A5D255FC58` |
| T34 | `TEST_AUTHORITY.md` | `CF82BCAA9AF89B082D57A3525E96CC58624EF15D51C57DD790051848A05AAF21` | `5EBD7456F7FDAD49B0E19FD0AFC5E57CAF5B1E07E341931C54B87265C465D460` |
| T38 | `DECISIONS_AND_INVARIANTS.md` | `B86E573B8FDDB68637A5CE9D9933E6C011BA19DD5918BD5BE397ABC64FF9BD88` | `0373BEAE72121A111394DB2D22243E44F2EBE48E51CCA1C9F308F4E919DA8082` |
| T38 | `GIT_DEPLOY_HISTORY.md` | `2EA70A2A9F2BCE7CCB78B462361486F96A67BA8F88E6E0FC6C0A3BA05155BA9F` | `25BE5072A9633D22D6CA0599481983898C98EC71B417F0661934C51BEBA3A194` |
| T38 | `P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md` | `57D995C64FE06CEE3BAA4CDD3EEEBC8C9B9ABD6802407EE0BAE10971210935DC` | `DA99247BC33FDB6041647F676E0381E45B59CAACADDC7A662858BDA60C17041E` |
| T38 | `ROADMAP.md` | `9BF0B2CCBC891234315322E427176FF2DBCD55033B90AD7EDF8BC49E0823DAF8` | `0F31DB75D495156500CF8CC437546A7C6F62DC0C9B998CD9179823A5D255FC58` |
| T38 | `TEST_AUTHORITY.md` | `CF82BCAA9AF89B082D57A3525E96CC58624EF15D51C57DD790051848A05AAF21` | `5EBD7456F7FDAD49B0E19FD0AFC5E57CAF5B1E07E341931C54B87265C465D460` |
| T39 | `COMPLETED_TASKS.md` | `0AD410E4AD2B7CCBF905C172D7D010D8CA6A8F3702AFD26BD22523EBD3E7F753` | `E0F89CDE1A44C61DDF675C5764BB7F0ABCED70847849122AF33F51595CEC2B2B` |
| T39 | `DECISIONS_AND_INVARIANTS.md` | `B86E573B8FDDB68637A5CE9D9933E6C011BA19DD5918BD5BE397ABC64FF9BD88` | `0373BEAE72121A111394DB2D22243E44F2EBE48E51CCA1C9F308F4E919DA8082` |
| T39 | `FINDINGS.md` | `9E1F64941EFA903D2568FBCC61CD552E205C36DC766F82701CD611E2D581D186` | `D30CF53F6144C95C4BAE49D6F4873D92235307A02886239F4844700071FC4729` |
| T39 | `GIT_DEPLOY_HISTORY.md` | `2EA70A2A9F2BCE7CCB78B462361486F96A67BA8F88E6E0FC6C0A3BA05155BA9F` | `25BE5072A9633D22D6CA0599481983898C98EC71B417F0661934C51BEBA3A194` |
| T39 | `P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md` | `57D995C64FE06CEE3BAA4CDD3EEEBC8C9B9ABD6802407EE0BAE10971210935DC` | `DA99247BC33FDB6041647F676E0381E45B59CAACADDC7A662858BDA60C17041E` |
| T39 | `ROADMAP.md` | `C683BCB07380C72F6D21F987B9C25C250F871911361F9227277744355B15E641` | `0F31DB75D495156500CF8CC437546A7C6F62DC0C9B998CD9179823A5D255FC58` |
| T39 | `TEST_AUTHORITY.md` | `CF82BCAA9AF89B082D57A3525E96CC58624EF15D51C57DD790051848A05AAF21` | `5EBD7456F7FDAD49B0E19FD0AFC5E57CAF5B1E07E341931C54B87265C465D460` |
| Doc reconcile | `COMPLETED_TASKS.md` | `0AD410E4AD2B7CCBF905C172D7D010D8CA6A8F3702AFD26BD22523EBD3E7F753` | `E0F89CDE1A44C61DDF675C5764BB7F0ABCED70847849122AF33F51595CEC2B2B` |
| Doc reconcile | `DECISIONS_AND_INVARIANTS.md` | `B86E573B8FDDB68637A5CE9D9933E6C011BA19DD5918BD5BE397ABC64FF9BD88` | `0373BEAE72121A111394DB2D22243E44F2EBE48E51CCA1C9F308F4E919DA8082` |
| Doc reconcile | `FINDINGS.md` | `9E1F64941EFA903D2568FBCC61CD552E205C36DC766F82701CD611E2D581D186` | `D30CF53F6144C95C4BAE49D6F4873D92235307A02886239F4844700071FC4729` |
| Doc reconcile | `GIT_DEPLOY_HISTORY.md` | `2EA70A2A9F2BCE7CCB78B462361486F96A67BA8F88E6E0FC6C0A3BA05155BA9F` | `25BE5072A9633D22D6CA0599481983898C98EC71B417F0661934C51BEBA3A194` |
| Doc reconcile | `P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md` | `57D995C64FE06CEE3BAA4CDD3EEEBC8C9B9ABD6802407EE0BAE10971210935DC` | `DA99247BC33FDB6041647F676E0381E45B59CAACADDC7A662858BDA60C17041E` |
| Doc reconcile | `ROADMAP.md` | `1F4C4AA87A70FCEB09617FA67DABF5E96019B56356952874F99167F397ECC6FB` | `0F31DB75D495156500CF8CC437546A7C6F62DC0C9B998CD9179823A5D255FC58` |
| Doc reconcile | `TEST_AUTHORITY.md` | `CF82BCAA9AF89B082D57A3525E96CC58624EF15D51C57DD790051848A05AAF21` | `5EBD7456F7FDAD49B0E19FD0AFC5E57CAF5B1E07E341931C54B87265C465D460` |

## T34 reports and addenda

All five requested T34 reports exist in the canonical `codex-reports` directory. They were checked for the R2/R3/R4 evidence/addenda, and the following canonical SHA-256 hashes were recorded:

| Report | Canonical SHA-256 | R2/R3/R4 evidence |
|---|---|---|
| `P2_T34_ANDROID_SESSION_ISOLATION_PHYSICAL_REPRO.md` | `C77B0197B1EA7452DE82FE889B1F52F274A5D3EC0CFA56F873AA2C07DFDD8AB3` | R2, R3 and R4 sections/evidence present |
| `P2_T34_R1_CASE_B_ROOT_CAUSE_DIAGNOSIS.md` | `6CBAFA662FAE4F8B4B72E0E734D82105824B1BC08E3328D15C8A26B74C2A581C` | R2, R3 and R4 addenda present |
| `P2_T34_R2_HISTORICAL_SESSION_ISOLATION_REGRESSION_AUDIT.md` | `FFFE09BA2D7E17A3C47048332F424F4070224CDC4AC93F29DCE67BDEF9ED1FF5` | R2 audit plus R4 closeout reference present |
| `P2_T34_R3_GOOGLE_OAUTH_FAMILY_SESSION_FIX.md` | `B75971983EFBAB835190E675394FE10E713D68F5E1CFE2794CB235FDF3B5FCD9` | R3 technical gate and R4 physical recertification addendum present |
| `P2_T34_R4_PHYSICAL_RECERTIFICATION_CLOSEOUT.md` | `3CCA37C9BD244FA7BD76109A21195F112BC845A9D77296F7438E4F9315CEAD17` | R2/R3 context and R4 closeout present |

The first four reports were found only in the canonical report directory among the five inspected worktrees. The R4 report also exists in the T34 worktree and matches canonical text exactly after line-ending normalization (raw SHA-256 is the same in this case). No T34 report was removed or changed.

## Canonical handoff copies outside `codex-reports`

The canonical paths `CODEX_REPORT.md` and `DELIGO_FULL_CONTEXT_LATEST.md` both exist. However, both filenames also exist at the root of each of the four noncanonical worktrees, contrary to the no-parallel-copy rule. Content comparison after line-ending normalization:

| Noncanonical worktree | `CODEX_REPORT.md` | `DELIGO_FULL_CONTEXT_LATEST.md` |
|---|---|---|
| T34 | Identical content | Identical content |
| T38 | Canonical is a superset | Canonical is a superset |
| T39 | Divergent; preserve/reconcile before removal | Divergent; preserve/reconcile before removal |
| Doc reconcile | Divergent; preserve/reconcile before removal | Divergent; preserve/reconcile before removal |

The four divergent handoff copies (two filenames in T39 and two in doc-reconcile) have unique content on both sides and are additional consolidation work beyond the 24 `codex-reports` divergences. No handoff copy was removed. These handoff copies are not included in the 299 report-directory-copy total.

## Markdown report-like files outside report directories

An inventory excluding Git internals, dependencies, build/cache directories, and nested `codex-reports` found 12 generated `human-report.md` files under canonical-worktree `load-tests\results\loadcert-*\`. They are distinct generated test-result artifacts, not same-name copies in the other worktrees. Their exact locations are:

- `load-tests\results\loadcert-1786679286337-0ce216d5\human-report.md`
- `load-tests\results\loadcert-1786679167585-c2e258e4\human-report.md`
- `load-tests\results\loadcert-1786679034867-0429557d\human-report.md`
- `load-tests\results\loadcert-1786668860311-97e9b187\human-report.md`
- `load-tests\results\loadcert-1786667548738-3c1d6474\human-report.md`
- `load-tests\results\loadcert-1786667466345-9e00b2be\human-report.md`
- `load-tests\results\loadcert-1786665084755-3c060a67\human-report.md`
- `load-tests\results\loadcert-1786663789279-88cf4c51\human-report.md`
- `load-tests\results\loadcert-1786661465080-5a4c9d74\human-report.md`
- `load-tests\results\loadcert-1786661251693-7beb0efb\human-report.md`
- `load-tests\results\loadcert-1786659937553-638cb194\human-report.md`
- `load-tests\results\loadcert-1786659679271-83c23513\human-report.md`

These may be generated outputs whose location is owned by the load-test workflow. They were not moved or removed. Operator should decide whether generated result artifacts are excluded from the “technical reports” location rule or whether their producer/output path should be changed; do not normalize them by deleting/moving without that decision. The scan also found `CLAUDE.md`/skill documentation, which is project guidance rather than a task report and was not classified as a report duplicate. Build snapshot directories (including `.next*`) were excluded from the active-worktree report inventory.

## Decision and next safe step

Content loss risk is **present** if any divergent copy is removed before reconciliation: at least 24 report-directory pairs and four handoff copies contain unique information on both sides. Preserve all source copies until each divergence is reviewed and its missing information is explicitly consolidated. The 275 content-equal/canonical-superset copies are later removal candidates, not authorization to remove them in this phase. Generated load-test reports remain untouched pending scope decision.

This audit intentionally did not perform the requested later normalization: no files were deleted, moved, or edited outside creating this audit; no commit/push, code/test/database, or Production action was performed. A subsequent operator-authorized phase should reconcile the 24 report divergences and four handoff divergences, decide the load-test artifact policy, re-compare, then handle only verified redundant copies while preserving Git history/synchronization separately.

## Required output markers

```text
RESULT=READ_ONLY_AUDIT_COMPLETE_WITH_DIVERGENCES
CANONICAL_REPORT_DIR=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports
WORKTREES_FOUND=5
NON_CANONICAL_REPORT_DIRS_FOUND=4
DUPLICATE_REPORT_COUNT=299
IDENTICAL_DUPLICATES=273
CANONICAL_NEWER_COUNT=2
WORKTREE_NEWER_COUNT=24
ONLY_NON_CANONICAL_COUNT=0
FILES_REQUIRING_CONSOLIDATION=24_REPORT_COPIES_PLUS_4_HANDOFF_COPIES
FILES_SAFE_TO_REMOVE_LATER=275_REPORT_COPIES_AFTER_AUTHORIZED_RECHECK
DATA_LOSS_RISK=YES_DIVERGENT_CONTENT_MUST_BE_RECONCILED_FIRST
CODE_MODIFIED=NO
FILES_DELETED=0
PRODUCTION_TOUCHED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_WITH_NORMALIZATION_AUDIT
```
