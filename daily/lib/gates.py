"""Read a HyperFrames gate's verdict out of its output.

This exists because the verdict has more than one shape and the difference is
not cosmetic. `lint` and `inspect` normally print a count line —

    ◇  0 error(s), 2 warning(s)
    ◇  0 errors, 0 warnings
    ◇  1 error(s), 0 warning(s), 10 info(s)

— but when a gate finds nothing whatsoever it prints a different line instead:

    ◇  0 layout issues across 9 sample(s)

A check for the literal "0 error(s)" therefore fails precisely on the cleanest
possible composition, and only once the layout is good enough to produce no
findings at all. That cost a scheduled run: every stage passed, inspect reported
zero issues, and the build refused the result it had just been handed.

An output with no recognisable verdict is a failure, not a pass. A gate whose
outcome cannot be read has not been passed.
"""
from __future__ import annotations

import re

_COUNTS = re.compile(r"(\d+)\s+(?:error|layout issue)", re.I)


def verdict(output: str) -> tuple[bool, str]:
    """(passed, the line to show). Passes only on an explicit zero."""
    for line in output.splitlines():
        counts = _COUNTS.findall(line)
        if counts:
            return all(int(c) == 0 for c in counts), line.strip()
    return False, "no verdict in the gate's output"
