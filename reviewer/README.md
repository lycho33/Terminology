# Terminology PR reviewer

Start this local reviewer from Codex. Use a GitHub CLI session that can read
the Terminology repository. To send notes, the session also needs permission
to create a pull request review. The panel uses the account from that session.

Use Node.js 24 or later. Run this from the repository root:

~~~sh
node reviewer/server.mjs
~~~

Ask Codex to open the loopback URL printed by the command in a panel beside the
chat. Keep the process running while you use the panel. The panel opens
with an architecture map. Select a draft or open PR below it to highlight
the affected areas. Select a test in the behavior list to open its walkthrough
dialog. Use **Preview selected notes** and
**Send to GitHub** to send the notes that you selected.

The reviewer reads the linked closing issue when GitHub returns one. It uses
the PR description if there is no linked issue. The architecture map comes
from the named file groups in components.mjs. The pilot uses checked source
links. Other revisions request a draft report from the local Codex CLI. Review
its source and test links. Keep any missing test or unverified behavior visible.

To capture browser test screenshots, set up the isolated Terminology tests.
If you run the reviewer from a separate checkout, give it the path to the
installed Terminology checkout:

~~~sh
TERMINOLOGY_REPO=/absolute/path/to/terminology node reviewer/server.mjs
~~~

The browser test needs its commit in the local repository. The reviewer
copies that commit into a temporary directory, runs the isolated Chromium
wrapper, and reads named screenshot attachments. A test with no screenshot
attachment can still provide assertions and fixture values. The reviewer
records the test result and tested commit with the images. For the verified
PR #14 revision, the reviewer adds two capture calls to the temporary copy
of SC-6 to show Preview and Cancel. The Save capture is already in the test.

For this pilot, set REVIEWER_PR14_EVIDENCE to a completed pilot wrapper run
directory with results.json, reviewer-revision.json, and its screenshot attachments to reuse the
three named images. Otherwise, select SC-6 and click **Run browser test**.

Run the reviewer tests with:

~~~sh
node --test reviewer/reviewer.test.mjs
~~~

To verify the pilot across the full panel, start the reviewer. Set REVIEWER_URL
to its loopback URL. The browser check uses the live PR list and runs SC-6
through the isolated runner. It intercepts the note submission.

~~~sh
REVIEWER_URL=http://127.0.0.1:<port> node reviewer/pilot.browser.mjs
~~~
