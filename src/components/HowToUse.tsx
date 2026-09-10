/**
 * Help content for both products: the weekly board, and the nightly close.
 *
 * The weekly guide is scoped deliberately to uploading. How the work gets
 * sourced, assigned and executed lives in the CH Figma Protocol — repeating it
 * here would just be a second copy to keep in sync.
 *
 * The close guide exists because "How to" sits in the corner menu on every
 * screen, including inside a checklist, and until now it explained the weekly
 * board to a bartender halfway through a close. A page about the wrong product
 * is worse than no page: the first thing it teaches is that the help is not
 * for you.
 */
import { LangSwitch, T } from "@/components/Lang";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="label mt-[5px] w-4 shrink-0">{n}</span>
      <span className="note leading-relaxed">{children}</span>
    </li>
  );
}

function Term({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-4">
      <span className="w-20 shrink-0 pt-[2px]">
        <span className="pill pill-pending">{label}</span>
      </span>
      <span className="note leading-relaxed">{children}</span>
    </li>
  );
}

/**
 * The short version, for the sign-in dialog. Deliberately fits on a phone
 * without scrolling — anything that needs scrolling belongs on /help, not in a
 * modal someone has to get past to start work.
 *
 * Two products share this door, and the crew signing in at one in the morning
 * are here for the checklists. So the checklists come first and in both
 * languages, and the weekly rule is one line under them rather than the whole
 * screen.
 */
export function HowToSummary({
  target,
  houses,
  deadlineLabel,
}: {
  target: number;
  /** How many boards are being scored — one until the kitchen goes live. */
  houses: number;
  deadlineLabel: string;
}) {
  return (
    <>
      <p className="label">
        <T en="Checklists" es="Listas" />
      </p>
      <ol className="mt-3 space-y-2">
        <Step n={1}>
          <T
            en="Pick your position, then the list you are on."
            es="Escoge tu puesto y luego la lista que te toca."
          />
        </Step>
        <Step n={2}>
          <T
            en="Initials on every item as you go. A photo where it asks for one."
            es="Iniciales en cada punto. Foto donde la pide."
          />
        </Step>
        <Step n={3}>
          <T
            en="The MOD signs at the end. Anything not done goes on the record with the name."
            es="El MOD firma al final. Lo que quedó sin hacer queda en el registro con el nombre."
          />
        </Step>
      </ol>

      <p className="label mt-5">
        <T en="Weekly progress" es="Progreso semanal" />
      </p>
      <p className="note mt-3 leading-relaxed">
        <T
          en={
            <>
              By {deadlineLabel}, all {target} items
              {houses > 1 ? " in each half" : ""} need a{" "}
              <strong>new photo</strong> and a <strong>new comment</strong>.
              Nothing carries forward.
            </>
          }
          es={
            <>
              Para el {deadlineLabel}, los {target} puntos
              {houses > 1 ? " de cada mitad" : ""} necesitan{" "}
              <strong>foto nueva</strong> y <strong>comentario nuevo</strong>.
              Nada se arrastra.
            </>
          }
        />
      </p>

      <p className="label mt-5 leading-relaxed">
        <T
          en="Full instructions any time under “How to”."
          es="Las instrucciones completas están siempre en “Cómo usar”."
        />
      </p>
    </>
  );
}

export function LeaderGuide({
  target,
  houses,
  deadlineLabel,
}: {
  target: number;
  /** How many boards are being scored — one until the kitchen goes live. */
  houses: number;
  deadlineLabel: string;
}) {
  return (
    <>
      <section className="panel mb-3">
        <h2 className="text-body font-medium">The rule</h2>
        <p className="note mt-4 leading-relaxed">
          By {deadlineLabel}, all {target} items
          {houses > 1 ? " in each half" : ""} need a <strong>new photo</strong>{" "}
          and a <strong>new comment</strong>. Nothing carries forward. Missing
          either one fails the item.
        </p>
      </section>

      {houses > 1 ? (
        <section className="panel mb-3">
          <h2 className="text-body font-medium">Two boards, two scores</h2>
          <p className="note mt-4 leading-relaxed">
            Front of house and the kitchen are separate lists of {target}, each
            walked and graded by a different person. They are never added
            together — a spotless dining room does not cover a kitchen that was
            not walked, and the week passes only if both halves do.
          </p>
        </section>
      ) : null}

      <section className="panel mb-3">
        <h2 className="text-body font-medium">Uploading</h2>
        <ol className="mt-5 space-y-4">
          <Step n={1}>Tap a card and take or choose the photo.</Step>
          <Step n={2}>Say whether it&apos;s done or needs one more cycle.</Step>
          <Step n={3}>Put your name in, and whoever helped you.</Step>
          <Step n={4}>
            Write the comment. Never blank — if it&apos;s done say so, if it
            isn&apos;t say why, if it&apos;s blocked say what&apos;s blocking
            it. &ldquo;Didn&apos;t get to this&rdquo; still counts.
          </Step>
          <Step n={5}>
            Submit. Nothing is overwritten — it adds to the item&apos;s history.
          </Step>
        </ol>
      </section>

      <section className="panel mb-3">
        <h2 className="text-body font-medium">Badges</h2>
        <ul className="mt-5 space-y-4">
          <Term label="Done">Photo and comment are in for this week.</Term>
          <Term label="Rolling">
            You marked it one more cycle. Counts for this week; the item
            continues.
          </Term>
          <Term label="Pending">
            Nothing uploaded yet. Fails after the deadline.
          </Term>
          <Term label="Redo">
            Sent back. Upload a new photo and comment to clear it.
          </Term>
        </ul>
      </section>

      <section className="panel">
        <h2 className="text-body font-medium">Everyone&apos;s board</h2>
        <p className="note mt-4 leading-relaxed">
          You can open any other venue and see what they uploaded. One team
          seeing another&apos;s work raises the bar for everyone.
        </p>
      </section>
    </>
  );
}

/**
 * Walking a checklist, for the person holding the phone at one in the morning.
 *
 * Ordered by when they need it rather than by how the thing is built: the
 * photo gate first because it is the only rule that stops somebody, then the
 * walk, then losing signal, then signing. The two manager sections come last
 * because a bartender never needs them and a manager will scroll.
 */
export function CloseGuide() {
  return (
    <>
      {/* First, and not by accident. Somebody who cannot read the rest of this
          page needs the section that gets them out of it, and the only word on
          the screen they can be relied on to recognise is the name of their own
          language. */}
      <section className="panel mb-3">
        <h2 className="text-body font-medium">
          <T en="Reading this in Spanish" es="Cambiar el idioma" />
        </h2>
        <p className="note mt-4 leading-relaxed">
          <T
            en="The English / Español switch is at the top of the checklists screen and again at the top of every list that has been translated. Tap Español and the items, the buttons and the sentence you sign all change over."
            es="El botón English / Español está arriba de la pantalla de listas y otra vez arriba de cada lista que ya está traducida. Toca Español y los puntos, los botones y la frase que firmas cambian de idioma."
          />
        </p>
        <p className="note mt-3 leading-relaxed">
          <T
            en="The phone remembers, so it is done once and never again. It is set per phone, so switching yours does not change the pad at the bar."
            es="El teléfono se acuerda, así que solo lo haces una vez. Es por teléfono, así que cambiar el tuyo no cambia la tablet de la barra."
          />
        </p>
        <LangSwitch className="mt-4" />
      </section>

      <section className="panel mb-3">
        <h2 className="text-body font-medium">
          <T en="The rule" es="La regla" />
        </h2>
        <p className="note mt-4 leading-relaxed">
          <T
            en="An item that asks for a photo cannot be ticked by hand. Taking the photo is what completes it. A tick says somebody remembered. A photo says it happened."
            es="Un punto que pide foto no se puede marcar a mano. La foto es lo que lo completa. Una marca dice que alguien se acordó. Una foto dice que sí pasó."
          />
        </p>
      </section>

      <section className="panel mb-3">
        <h2 className="text-body font-medium">
          <T en="Walking a list" es="Cómo hacer tu lista" />
        </h2>
        <ol className="mt-5 space-y-4">
          <Step n={1}>
            <T
              en="Pick your position, then the list you are on: open, mid or close."
              es="Escoge tu puesto y luego la lista que te toca: apertura, medio turno o cierre."
            />
          </Step>
          <Step n={2}>
            <T
              en="Tap an item and put your initials in. It saves the moment you tap."
              es="Toca un punto y pon tus iniciales. Se guarda en cuanto lo tocas."
            />
          </Step>
          <Step n={3}>
            <T
              en="Initials go on every item, not once at the start. Four people work a close on one phone, and “who did the restrooms” has to have an answer."
              es="Las iniciales van en cada punto, no una sola vez al principio. Cuatro personas pueden hacer un cierre con un solo teléfono, y “quién hizo los baños” tiene que tener respuesta."
            />
          </Step>
          <Step n={4}>
            <T
              en="Working alone, the app carries your initials down to the items below. If somebody takes over, they type theirs over the row they are on and it carries theirs from there."
              es="Si trabajas solo, la app va poniendo tus mismas iniciales en los puntos de abajo. Si alguien te releva, esa persona escribe las suyas encima del punto donde va y de ahí en adelante quedan las de ella."
            />
          </Step>
          <Step n={5}>
            <T
              en="Where an item asks for a photo, a video or a note, that is what finishes it. There is no way to mark it done without one."
              es="Cuando un punto pide foto, video o una nota, eso es lo que lo termina. No hay forma de marcarlo como hecho sin eso."
            />
          </Step>
        </ol>
      </section>

      <section className="panel mb-3">
        <h2 className="text-body font-medium">
          <T en="If the signal drops" es="Si se cae la señal" />
        </h2>
        <p className="note mt-4 leading-relaxed">
          <T
            en="Keep going. Ticks and photos are saved on the phone and go up on their own once you are back in range, and a line at the top of the list says what it is still holding."
            es="Sigue trabajando. Las marcas y las fotos se guardan en el teléfono y se suben solas cuando vuelvas a tener señal. Arriba de la lista aparece una línea que dice qué falta por subir."
          />
        </p>
        <p className="note mt-3 leading-relaxed">
          <T
            en="One catch: open the app while you still have signal. It cannot load from cold with none."
            es="Una cosa: abre la app cuando todavía tengas señal. No puede cargar desde cero sin ella."
          />
        </p>
      </section>

      <section className="panel mb-3">
        <h2 className="text-body font-medium">
          <T en="Signing off" es="Firmar al final" />
        </h2>
        <p className="note mt-4 leading-relaxed">
          <T
            en="The MOD signs at the end. You type your name, sign, and the app records exactly what you are putting your name to, naming anything not done. Once it is signed the list is locked and nothing on it can change."
            es="El MOD firma al final. Escribes tu nombre, firmas, y la app guarda exactamente lo que estás firmando, nombrando lo que quedó sin hacer. Una vez firmada, la lista se cierra y ya nada se puede cambiar."
          />
        </p>
        <p className="note mt-3 leading-relaxed">
          <T
            en="If the phone is still holding work, the signature waits until that work has gone up. Signing over it would lose it."
            es="Si el teléfono todavía tiene trabajo sin subir, la firma espera hasta que suba. Firmar encima lo perdería."
          />
        </p>
      </section>

      <section className="panel mb-3">
        <h2 className="text-body font-medium">
          <T en="Writing a list" es="Escribir una lista" />
        </h2>
        <p className="note mt-4 leading-relaxed">
          <T
            en="Edit list is in the menu while you are on one, and again at the foot of it. A venue owns its own lists: you invent the position, write the items, say which ones owe a photograph, and retire them when the job changes."
            es="Editar lista está en el menú mientras estás en una, y también hasta abajo de ella. Cada lugar es dueño de sus propias listas: tú inventas el puesto, escribes los puntos, dices cuáles necesitan foto, y los retiras cuando cambia el trabajo."
          />
        </p>
        <p className="note mt-3 leading-relaxed">
          <T
            en="Each item has a Spanish box under the title. Fill it in and that item reads in Spanish for anybody who has tapped Español. Leave it empty and nothing changes."
            es="Cada punto tiene una casilla de español debajo del título. Si la llenas, ese punto se lee en español para quien haya tocado Español. Si la dejas vacía, no cambia nada."
          />
        </p>
      </section>

      <section className="panel">
        <h2 className="text-body font-medium">
          <T en="Reference photos" es="Fotos de referencia" />
        </h2>
        <p className="note mt-4 leading-relaxed">
          <T
            en="The other direction from proof. Proof is what an item owes at the end of the night. A reference is what right looks like, and the crew sees it while they are doing the job. Open an item in the editor and add one, up to four an item."
            es="Lo contrario de la prueba. La prueba es lo que un punto debe al final de la noche. Una referencia es cómo se ve bien, y el equipo la ve mientras hace el trabajo. Abre un punto en el editor y agrégala, hasta cuatro por punto."
          />
        </p>
        <p className="note mt-3 leading-relaxed">
          <T
            en="Shoot them on your own bar. Whoever runs it knows what a correct well looks like there, and a picture taken anywhere else is a different bar. It also means they get retaken the week the layout changes, by the person who changed it."
            es="Tómalas en tu propia barra. Quien la maneja sabe cómo se ve bien ahí, y una foto tomada en otro lado es otra barra. También quiere decir que se vuelven a tomar la semana que cambia el acomodo, por la persona que lo cambió."
          />
        </p>
      </section>
    </>
  );
}
