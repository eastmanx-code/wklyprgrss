/**
 * Fixture checks for reading a capture back out of its filename.
 *
 *   npm run check-adopt
 *
 * This decides whether a photograph counts. A file it fails to recognise is a
 * photograph that stays invisible on the server, which is the exact failure
 * being fixed; a file it recognises wrongly puts the wrong picture against an
 * item and reports a job as proved that was not.
 *
 * The real names in here are copied from production, including the two from
 * the night three photographs went missing.
 */
import { kindOf, newestFor, stampOf } from "../.adopt-check/adopt-names.js";

let pass = 0,
  fail = 0;
const is = (label, got, want) => {
  if (got === want) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL ${label}\n    got  ${got}\n    want ${want}`);
  }
};

// ------------------------------------------------------------------ what it is

is("a compressed photo is a photo", kindOf("0-1788897523373.jpg"), "photo");
is("an iPhone video is a video", kindOf("0-1788862280688.mov"), "video");
is("an mp4 is a video", kindOf("0-1788829679319.mp4"), "video");
// The fallback for a photo that would not shrink sends the original, which on
// an iPhone is HEIC. Before that change this case could not happen.
is("an original heic is a photo", kindOf("0-1788897510431.heic"), "photo");
is("upper case still reads", kindOf("0-1788897510431.JPG"), "photo");
is("no extension is nothing", kindOf("0-1788897510431"), null);
is("something else is nothing", kindOf("notes-1788897510431.txt"), null);

// ------------------------------------------------------------- which shot

is("shot 0 belongs to shot 0", stampOf("0-1788897523373.jpg", 0), 1788897523373);
is("shot 0 does not belong to shot 1", stampOf("0-1788897523373.jpg", 1), null);
is("shot 1 belongs to shot 1", stampOf("1-1788808759912.jpg", 1), 1788808759912);
// The one that a looser match gets wrong: ten must not read as one.
is("shot 10 is not shot 1", stampOf("10-1788808759912.jpg", 1), null);
is("shot 10 is shot 10", stampOf("10-1788808759912.jpg", 10), 1788808759912);
is("a name with no stamp is nothing", stampOf("0-.jpg", 0), null);
is("a name with no shot is nothing", stampOf("-1788808759912.jpg", 0), null);
is("a zero stamp is nothing", stampOf("0-0.jpg", 0), null);
is("a stray name is nothing", stampOf("screenshot.jpg", 0), null);
is("a nested path is not a name", stampOf("close/x/0-1788897523373.jpg", 0), null);

// ------------------------------------------------------------ which one counts

// The real retake from the bartender close: three uploads for one shot,
// twelve minutes apart. The last one is the one that counts.
{
  const retakes = [
    "0-1788859885706.jpg",
    "0-1788860165981.jpg",
    "0-1788860756113.jpg",
  ];
  is("the newest retake wins", newestFor(retakes, 0), "0-1788860756113.jpg");
  // Storage does not promise an order, so neither can this.
  is(
    "order of listing does not matter",
    newestFor([...retakes].reverse(), 0),
    "0-1788860756113.jpg",
  );
}

// Two shots on one item share a folder and must not be confused for each
// other. This is the reference shot shape, which has both.
{
  const both = ["0-1788808506414.jpg", "1-1788808517866.jpg"];
  is("shot 0 picks its own", newestFor(both, 0), "0-1788808506414.jpg");
  is("shot 1 picks its own", newestFor(both, 1), "1-1788808517866.jpg");
  is("shot 2 picks nothing", newestFor(both, 2), null);
}

is("an empty folder adopts nothing", newestFor([], 0), null);
is("a folder of junk adopts nothing", newestFor(["thumb.db", ".keep"], 0), null);
// A file with a stamp but an extension nobody can render is not evidence.
is(
  "a stamped file of unknown type adopts nothing",
  newestFor(["0-1788860756113.txt"], 0),
  null,
);
// The one that matters most: a newer file of an unknown type must not beat a
// good older one, and must not win on its own either.
is(
  "junk does not beat a real capture",
  newestFor(["0-1788860756113.txt", "0-1788859885706.jpg"], 0),
  "0-1788859885706.jpg",
);

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
