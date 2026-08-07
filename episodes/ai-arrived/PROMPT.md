Write the voiceover for a 30-second vertical documentary reel about: how artificial intelligence entered everyday life

Return ONLY a JSON object, no prose around it, in exactly this shape:

{
  "id": "ai-arrived",
  "title": "a short title for the episode",
  "mood": "cold-noir",
  "style": "documentary photograph, period-accurate, available light, muted colour, fine grain, no text, no watermark, no modern objects",
  "lines": [ six line objects ]
}

THE SCRIPT — this is the hard part, and the constraints are not style notes:

* EXACTLY SIX lines, one per scene. Around 80 words TOTAL, no line over 15 words.
  Thirty seconds of narration is 80 words. A line that will not fit in fifteen
  words is two lines or it is cut.
* Line 1 is the hook and must be able to stop a scroll on its own.
* Line 6 is the verdict. If there is a number worth saying, say it here.
* Write VERBS. What was done, what collapsed, what arrived. "He gave it away and
  the price collapsed" is a scene; "he was extremely wealthy" is a caption.
* Every line must end in a full stop, and each is spoken with a pause after it —
  they are cut apart at those pauses, so no line may run into the next.
* You do not need an original story. Take one that already works and tell it
  sharper than everyone else did.

EACH LINE OBJECT:

  "slug"          one lowercase word, unique, used in file names
  "vo"            the spoken line
  "image"         one phrase: what we are LOOKING at. Scenery, no people named.
  "imageCommons"  1-3 Wikimedia Commons searches for something that REALLY
                  EXISTS and is photographed — a named place, building, map or
                  artefact. Most specific first, broader as fallback. Omit only
                  if the shot is genuinely nameless scenery.

OPTIONAL, and only where the line earns it — an unused one is better than a
wrong one:

  "kicker","title","footer"   for a line that STATES something. The title is set
                              large; make it two or three words, or a number.
  "artefact" + "artefactCommons"
                              for a line about ONE object. Becomes a flight into
                              a photograph of it.
  "stops"                     3-5 real place names, for a line about a journey.
                              Draws an itinerary, stop by named stop.
  "pieces"                    2-3 single objects to stand in the frame, each
                              phrased as one thing: "camel standing in profile".
  "items"                     up to 3 cards as "card|HEADING|one short line",
                              for a line that lists three things.
  "caption"                   2-3 short fragments that land one at a time.
  "onScreen"                  one very short card, 2-3 words.
  "motif"                     coins | rise | route | embers | rays | tally —
                              what gets DRAWN acting out the line's verb. Or
                              "none" to leave the shot alone. Leave it out and
                              it is inferred from the words.

Return the JSON and nothing else.
