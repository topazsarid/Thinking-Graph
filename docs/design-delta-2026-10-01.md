כן. ואני חושבת שכדאי שהסיכום הזה יהיה **Delta מה־handoff של 28.09**, ולא סיכום מחדש של כל הפרויקט. כלומר: "אלה הדברים שהשתנו/התחדדו מאז המצב שכבר קיים בקוד."

הנה הגרסה שהייתי מעבירה ל־Work:

# Thinking Graph — Design Delta Since 28.09 Handoff

מסמך זה מתאר רק החלטות ושינויים שנוספו מאז ה־handoff הקודם.  
אין לבנות מחדש חלקים קיימים שלא מושפעים מהם.

## 1. ה־MVP מתמקד כרגע ב־Learning / Thinking flow

המטרה הקרובה היא לא לממש את כל החזון של Thinking Graph, אלא לבנות vertical slice שבו משתמש מנסה להבין משהו דרך שילוב של:

- Chat
- My Map
- Canvas
- Interactive Representations
- מרחב/שכבה זמנית שבה המערכת יכולה להציג את המודל/ההסבר שלה

מקרי הבדיקה הראשונים:

1. Electric field / vector field — להבין למה הווקטורים נראים כפי שהם נראים.
2. Chess — להבין/לזכור את הלוח והתנועות באמצעות representations אישיים ואינטראקטיביים.

שני המקרים שונים בכוונה, כדי לבדוק שהתשתית כללית ולא hard-coded לדומיין אחד.

---

# 2. My Map היא מרכז המוצר, לא visualization של הצ'אט

התחדד ש־My Map אינה תוצר משני של שיחה.

המטרה היא שהמשתמש יוכל **לחשוב דרך המפה עצמה**:

- ליצור Ideas
- להזיז אותם
- ליצור קשרים
- לחבר באמצעות קו/חץ/קיבוץ וכו'
- לעבוד גם עם דברים שעדיין אינם מוגדרים היטב
- לגרור representations בין המרחבים
- להשתמש במפה כ־thinking playground

המפה לא צריכה להרגיש כמו סיכום שה־AI יצר אחרי שהסביר משהו.

## Empty My Map

גם בעולם חדש, My Map יכולה להיות גלויה ושימושית.

במקום empty state פסיבי, אפשר בעתיד להציע affordances כגון:

- Idea ריק
- Question / ?
- שני objects עם קשר לא מוגדר
- placeholder למשהו שהמשתמש מרגיש שקיים אבל עדיין לא יודע להגדיר
- אזור לקיבוץ דברים
- אפשרויות manipulation בסיסיות

המטרה היא לאפשר להתחיל לחשוב דרך המרחב גם לפני שיש תוכן מסודר.

אין צורך כרגע להחליט על כל סוגי ה־placeholder.

---

# 3. יש להפריד בין My Map לבין המרחב שהמערכת משתמשת בו להסבר

המערכת צריכה להיות מסוגלת לבנות representation משלה של הנושא בלי לשנות את My Map.

שם העבודה הזמני הוא Explanation Map / System Map; אין צורך שזה יהיה השם הסופי ב־UI.

## System / Explanation Map

- דינמית.
- המערכת יכולה להוסיף/להסיר בה concepts ו־relations.
- משתנה לפי השיחה.
- יכולה לעשות conceptual zoom.
- אינה מייצגת "מה המשתמש יודע".
- אינה נכתבת אוטומטית לתוך My Map.

## My Map

- user-curated.
- המערכת אינה מחליטה אוטומטית מה נכנס אליה.
- המשתמש יכול ליצור דברים בעצמו.
- המשתמש יכול לגרור/להעתיק דברים מהמרחב של המערכת אל My Map.
- AI יכול להציע, המשתמש מחליט.

העיקרון הקיים נשמר:

**AI proposes; user decides.**

אבל ההצעות של ה־AI יכולות להופיע בחופשיות במרחב של המערכת בלי צורך באישור על כל node, משום שהן עדיין לא חלק מ־My Map.

---

# 4. Concept identity נפרדת מה־Representation

עיקרון ליבה חדש:

**Concept identity stays stable; representation can change.**

לדוגמה:

Concept:
`Knight`

יכול להופיע כ:

- המילה Knight בצ'אט
- node במפה
- ♞ בלוח שחמט
- label אישי "Regina"
- icon/image שהמשתמש בחר
- animation / interactive object

אלה אינם Ideas שונים.

הם representations שונים של אותו underlying concept.

אותו עיקרון:

`Electric Field`

יכול להופיע כ:

- טקסט
- node
- `E`
- equation
- vector visualization
- interactive field
- contextual explanation

---

# 5. Personal Representations

המשתמש יוכל בעתיד להתאים representation למשהו שעוזר לו לחשוב.

דוגמת שחמט:

Canonical concept:
`Knight`

Personal representation:
- label: Regina
- analogy/context: Mean Girls
- optional icon/image
- optional movement hint

ה־canonical concept לא משתנה.

אין צורך לממש כרגע personalization מלא, אבל הארכיטקטורה לא צריכה להניח של־Concept יש representation יחיד.

---

# 6. Chat יכול לשנות Representations

הצ'אט אינו רק מקום לקבל הסברים.

המשתמש יכול להשתמש בשפה טבעית כדי לשנות את הייצוג הפעיל.

לדוגמה:

- "תכתוב מילים במקום P ו־Q."
- "תשאיר E אבל תסביר מה P."
- "תעלים את הכלים ותשאיר את המשבצות."
- "תראה רק את הרצים."
- "תציג לי את הפרש כ־Regina."
- "תראה את זה בצורה אחרת."

כאשר אפשר, השינוי צריך לקרות ב־representation עצמו ולא רק לקבל תשובת טקסט.

---

# 7. Shared identity בין Chat / Map / Canvas / Interactive

כאשר אותו concept מופיע במספר representations, המערכת צריכה לדעת שהם מתייחסים לאותו דבר.

לדוגמה, לחיצה על `E` בתוך interactive יכולה:

- להדגיש את Electric Field במפה
- להדגיש occurrence רלוונטי בצ'אט
- לפתוח את ההסבר/ההגדרה הרלוונטיים
- להדגיש representations נוספים של אותו concept

המטרה היא שהלוחות יהיו מחוברים סמנטית ולא רק מוצגים זה לצד זה.

---

# 8. Contextual Glossary

נדרש מנגנון שמסביר symbols/concepts בתוך ההקשר שבו הם מופיעים.

לדוגמה ב־Electric Field interactive:

- `Q` — המטען שממנו אנחנו כרגע בונים את השדה
- `P` — הנקודה שהמשתמש מזיז כרגע
- `E` — וקטור השדה החשמלי בנקודה P

זה אינו רק dictionary definition.

ההגדרה יכולה להשתנות באופן הצגתה בהתאם לבקשת המשתמש.

לדוגמה המשתמש יכול לבקש:

- הגדרה פשוטה יותר
- הגדרה פורמלית יותר
- representation אישי
- מילים במקום symbols
- הסבר ביחס למה שהוא עושה כרגע

אותו Concept יכול להיות המקור המשותף ל־glossary entries בכל ה־representations.

---

# 9. Map → Canvas אינו transformation אוטומטי

כאשר מעבירים משהו מהמפה ל־Canvas, נדרשות לפחות שתי פעולות שונות.

## Copy

העתקה כפי שהוא.

אין לבצע reinterpretation אוטומטי.

## Copy as Interactive / Represent As...

בקשה מפורשת ליצור representation אחר.

לדוגמה:

`Electric field` → interactive vector field.

בעתיד ניתן להציע representations נוספים לפי סוג התוכן.

---

# 10. Canvas הוא Workbench ולא רק Drawing Board

ה־Canvas ממשיך לאפשר ציור חופשי, אבל יכול להכיל גם objects נוספים.

Conceptually אפשר לחשוב על layers כגון:

1. User drawing layer
2. Representation layer
3. Interactive/simulation layer

Interactive Representation יכול להיות movable/resizable object או floating panel מעל ה־Canvas.

הוא לא חייב להפוך לחלק מהציור עצמו.

---

# 11. Interactive Representation הוא abstraction כללי

Interactive אינו feature ספציפי לפיזיקה.

המטרה היא ליצור תשתית שממנה אפשר להרכיב representations שונים.

Primitives אפשריים:

- Grid / Table
- Coordinate Space
- Graph / Network
- Diagram
- Geometry
- Plot
- Timeline / Sequence
- Equation / Symbols
- Text / Labels
- Image / Icon
- Animation / Simulation
- Controls

אין צורך לממש את כולם ב־MVP.

הם צריכים להיות composable.

לדוגמה:

Chess:

`Grid + pieces/icons + labels + arrows + highlights + controls`

Electric field:

`Coordinate space + points + vectors + labels + drag controls`

---

# 12. Layers + visibility controls

Interactive Representation צריך לאפשר שליטה במה שהמשתמש רואה.

לפחות ברמת המודל:

- Show
- Hide
- Highlight
- Isolate
- Fade others

לדוגמה בשחמט:

- coordinates
- square colors
- pieces
- piece labels
- legal moves
- attacked squares
- arrows
- personal icons

המשתמש יכול לשלוט בזה דרך UI וגם דרך Chat.

דוגמה:

"תעלים את כל הכלים ותשאיר רק את שמות המשבצות."

---

# 13. Reveal / memory practice

בעתיד visibility יכול לשמש גם ללמידה וזיכרון.

לדוגמה בשחמט:

1. Hide pieces
2. המשתמש מנסה לדמיין את המיקום
3. Reveal
4. Compare
5. Hide again

או:

"Where is the white bishop?"

המשתמש מסמן → Reveal → feedback.

אין צורך לבנות מערכת תרגול מלאה כרגע; רק לאפשר ל־visibility/layers להתפתח לכיוון הזה.

---

# 14. Field visualization — Grid אינו השדה עצמו

ב־Electric Field test case חשוב לשמור על ההבחנה:

השדה הרציף הוא concept מתמטי/פיזיקלי.

Grid/matrix הוא representation/discretization אפשרי שלו לצורך הצגה וחישוב.

Interactive יכול לאפשר:

- show/hide sampling grid
- show/hide vectors
- שינוי sampling density
- source charge
- draggable point
- vector שמתעדכן בזמן אמת

אין למודל את ההנחה `field = matrix`.

---

# 15. Focus

המערכת צריכה לדעת מהו ה־concept / representation / question הפעיל בזמן הודעה.

לדוגמה:

המשתמש מזיז נקודה ב־Electric Field interactive ואז כותב:

"אה, אז הכיוון תלוי במיקום ביחס למטען."

צריך להיות אפשר לדעת שההודעה נאמרה בזמן שה־interactive הזה היה ב־focus.

Focus יכול לאפשר:

- provenance
- קישור insight לפעילות שיצרה אותו
- continuation בצ'אט בלי לאבד context
- הצעה עתידית להוסיף insight ל־My Map

אין צורך כרגע במנגנון מלא שמחליט אוטומטית "המשתמש הבין".

---

# 16. Semantic / Conceptual Zoom

במרחב ההסבר של המערכת, zoom אינו רק camera zoom.

השיחה יכולה לשנות את רמת ההפשטה של התוכן.

לדוגמה:

Electromagnetism  
→ Electric field  
→ Field vector  
→ Direction / magnitude  
→ Why this vector at this point?

כאשר השאלה נעשית ספציפית יותר, המערכת יכולה להתמקד במבנה הרלוונטי.

---

# 17. שלושת המרחבים אינם pipeline לינארי

אין להניח:

`Chat → Map → Canvas`

כל אחד יכול להיות נקודת התחלה.

לדוגמה:

- משתמש מתחיל בצ'אט
- משתמש יוצר node ב־My Map
- משתמש מצייר
- משתמש מחבר שני placeholders
- משתמש גורר representation
- משתמש משחק ב־interactive

ה־AI מצטרף לתהליך לפי הפעולה וה־context.

המטרה היא שהמערכת תרגיש כמו **thinking environment**, לא כמו AI tutor שמציג הסברים.

---

# 18. Cognitive operations — distinction discovered, not necessarily DB entities yet

התחדדה הבחנה בין:

### Relation
טענה על היחס בין דברים.

לדוגמה:
`A causes B`

### Cognitive operation
פעולה על representation/knowledge.

לדוגמה:

- compare
- contrast
- decompose
- generalize
- reframe
- analogize
- construct/build-up
- predict
- classify

Operation יכול ליצור Relation חדש, או Relation קיים יכול לעורר Operation.

אין צורך כרגע להפוך את כל cognitive operations לטבלאות או taxonomy.

הן כרגע כלי לחשיבה על interaction design.

---

# 19. Reframing אינו רק "עוד ניסוח"

אחד הכיוונים החשובים שהתחדדו:

הבעיה בצ'אט רגיל אינה בהכרח שאין reframing, אלא שקשה לראות ולשמור את המעבר בין representations.

המערכת צריכה בעתיד להיות מסוגלת לעשות:

`current representation → operation → alternative representation`

ולאפשר למשתמש לראות/להשוות ביניהם.

במידת האפשר, המערכת צריכה לבצע ניסויים על copy/working version ולא להרוס את representation המקורי של המשתמש.

---

# 20. Explanation loop צריך להיות diagnostic, לא rephrase loop

כאשר משתמש אומר "לא הבנתי", לא להניח שהפתרון הוא עוד ניסוח של אותו הסבר.

Flow רצוי:

Explanation  
→ user reaction  
→ identify possible gap  
→ choose another representation/operation  
→ user manipulates / responds  
→ update focus  
→ continue

דוגמת Electric Field הראתה שלפעמים הבעיה אינה ההגדרה של Field אלא השאלה:

"למה דווקא הווקטור הזה מופיע דווקא בנקודה הזאת?"

ולכן build-up / construction יכול להיות יעיל יותר מעוד טקסט.

---

# 21. Scoping של ה־MVP

כרגע לא להרחיב אל:

- Fly agent experiment
- reinforcement learning
- organizational/social network
- collaborative mode
- audio/sonification
- generalized pattern detection
- psychology state
- full learner model
- complete cognitive-operation taxonomy
- complete relation taxonomy
- generalized simulation generator for every domain

הרעיונות האלה נשארים Vision/Parked ולא נמחקים.

---

# 22. ה־Vertical Slice הנוכחי

יש לבדוק את התשתית עם שני examples בלבד.

## A. Electric Field

מטרת הבדיקה:

המשתמש לא מבין למה vectors נראים כפי שהם נראים.

נדרש לאפשר:

- Chat
- representation/map של concepts הרלוונטיים
- מעבר ל־Interactive
- source charge
- draggable point
- vector שמתעדכן בזמן אמת
- contextual glossary ל־Q/P/E
- show/hide layers
- שינוי representation דרך Chat
- שמירת focus
- highlighting של אותו concept בין representations
- אפשרות לקחת משהו שהמערכת הציגה ולהוסיף ל־My Map

## B. Chess

מטרת הבדיקה:

המשתמש מנסה לבנות representation פנימי טוב יותר של הלוח.

נדרש לבדוק את אותה תשתית באמצעות:

- 8×8 Grid
- pieces
- coordinates
- labels
- arrows / legal moves
- show/hide/isolate
- representations אישיים כגון Knight → Regina
- optional icon/image
- Reveal לצורך memory practice

אין צורך לבנות Chess tutor מלא.

המטרה היא לבדוק שאותו representation/layer architecture עובד גם בדומיין שונה מפיזיקה.

---

# 23. כלל implementation

לפני שינוי משמעותי ב־DB או rewrite של חלק קיים:

1. למפות את הדרישה למבנים שכבר קיימים.
2. לזהות מה באמת חסר.
3. להציג את השינוי הנדרש לפני redesign רחב.
4. לא לשבור functionality קיימת שאינה קשורה ל־vertical slice.

`created_by` נשאר provenance ולא ownership.

המערכת מציעה; המשתמש קובע מה הופך לחלק מה־My Map.

בדיקות UI נשארות רק בדפדפן Codex המובנה, בלשונית נפרדת. אין להשתמש בכרום האישי ואין לשלוח תוכן לשירות חיצוני ללא אישור.

יש פה שינוי אחד די גדול ביחס למסמך הקודם שלנו: **אני כבר לא הייתי מגדירה את ה־MVP כ־"Learning Space שבו AI מסביר דרך שלושה לוחות".** אחרי הדיון האחרון, ההגדרה המדויקת יותר היא:

> **Thinking environment שבו My Map היא המרכז, והמשתמש והמערכת יכולים לעבוד על אותו concept דרך representations שונים — טקסט, מפה, ציור ואובייקטים אינטראקטיביים.**

הלמידה היא כרגע ה־**use case שבאמצעותו אנחנו בודקות את הליבה**, ולא בהכרח הזהות הסופית של המוצר. זה הבדל קטן בניסוח אבל גדול מאוד מבחינת מה ש־Work עלול לבנות.