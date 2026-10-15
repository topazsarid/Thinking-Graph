"""Layout: top bar and its menus, effect studio, conversation side menu, focus mode,
drawing zoom and the empty-workspace picker."""
from playwright.sync_api import expect
from e2e_helpers import png, send


def test_top_bar_menus_and_second_bar(app, page):
    app.post('workspace', title='מרחב')
    page.reload(); page.wait_for_selector('#draft')
    top = page.locator('header.topbar')
    assert page.get_by_text('שמירה מקומית במחשב').count() == 0
    labels = [t.strip() for t in top.locator('button').all_inner_texts() if t.strip()]
    assert labels == ['שיחות', 'אפקטים', 'פתקים']
    # In a short window the page scrolls and the top bar stays at the top.
    page.set_viewport_size({'width': 1400, 'height': 420})
    page.evaluate('window.scrollTo(0, 400)'); page.wait_for_timeout(300)
    assert page.evaluate('scrollY') > 0 and abs(top.bounding_box()['y']) < 1
    page.evaluate('window.scrollTo(0, 0)'); page.set_viewport_size({'width': 1400, 'height': 800})
    # The second bar hides and shows, and the choice is remembered.
    page.get_by_label('הסתרת סרגל המרחבים').click()
    assert page.get_by_label('בחרי מרחב').count() == 0
    page.reload(); page.wait_for_selector('#draft')
    assert page.get_by_label('בחרי מרחב').count() == 0
    page.get_by_label('הצגת סרגל המרחבים').click()
    expect(page.get_by_label('בחרי מרחב')).to_be_visible()
    # Notes menu.
    top.get_by_role('button', name='פתקים').click()
    for name in ['יצירת פתק', 'חילוץ מפתקים', 'כל הפתקים (0)']:
        expect(page.get_by_role('menuitem', name=name)).to_be_visible()
    page.get_by_role('menuitem', name='יצירת פתק').click()
    expect(page.get_by_role('dialog')).to_be_visible()
    page.keyboard.press('Escape')


def test_effects_menu_and_studio(app, page, tmp_path):
    top = page.locator('header.topbar')
    top.get_by_role('button', name='אפקטים').click()
    page.get_by_role('menuitemcheckbox', name='גן צומח').click()
    page.keyboard.press('Escape')
    expect(page.locator('.board-effects .growing-garden')).to_have_count(1)
    top.get_by_role('button', name='אפקטים').click()
    page.get_by_role('menuitemcheckbox', name='גן צומח').click()
    page.keyboard.press('Escape')
    expect(page.locator('.board-effects .growing-garden')).to_have_count(0)
    # Pattern: choose the number of squares, paint by dragging, play, save.
    top.get_by_role('button', name='אפקטים').click()
    page.get_by_role('menuitem', name='יצירת אפקט…').click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_label('מספר משבצות', exact=False).fill('12')
    cells = dialog.locator('.pattern-grid button')
    expect(cells).to_have_count(144)
    # Measure only after the dialog's opening animation, or the squares are still moving.
    page.wait_for_function('[...document.querySelectorAll("[role=dialog]")].every(d=>d.getAnimations({subtree:true}).every(a=>a.playState!=="running"))')
    a, b = cells.nth(0).bounding_box(), cells.nth(5).bounding_box()
    page.mouse.move(a['x'] + 3, a['y'] + 3); page.mouse.down()
    page.mouse.move(b['x'] + 3, b['y'] + 3, steps=2); page.mouse.up()  # a fast drag: few pointer events
    painted = cells.evaluate_all('els=>els.filter(e=>e.style.background&&e.style.background!=="transparent").length')
    assert painted == 6  # every square on the way is filled, none skipped
    dialog.get_by_placeholder('ההדפס הוורוד שלי').fill('ההדפס שלי')
    dialog.get_by_role('button', name='שמירה לאפקטים שלי').click()
    dialog.get_by_role('button', name='הפעלה').click()
    expect(page.locator('.board-effects .pattern-layer')).to_have_count(1)
    top.get_by_role('button', name='אפקטים').click()
    expect(page.get_by_role('menuitem', name='ההדפס שלי')).to_be_visible()
    # Images: upload two, they float and move.
    page.get_by_role('menuitem', name='יצירת אפקט…').click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_role('radio', name='תמונות').click()
    dialog.locator('input[type=file]').set_input_files([png(tmp_path / 'red.png', (220, 40, 60)), png(tmp_path / 'blue.png', (40, 80, 220))])
    expect(dialog.locator('.studio-images img')).to_have_count(2)
    dialog.get_by_role('button', name='הפעלה').click()
    images = page.locator('.board-effects .floating-images img')
    expect(images.first).to_be_attached()
    first = images.first.evaluate('e=>e.style.transform'); page.wait_for_timeout(700)
    assert images.count() >= 2 and images.first.evaluate('e=>e.style.transform') != first
    top.get_by_role('button', name='אפקטים').click()
    page.get_by_role('menuitem', name='כיבוי האפקט שלי').click()
    expect(page.locator('.board-effects .floating-images')).to_have_count(0)
    top.get_by_role('button', name='אפקטים').click()
    page.get_by_role('menuitem', name='שינוי צבע…').click()
    expect(page.get_by_text('בחירת צבע למערכת')).to_be_visible()


def test_conversation_menu_opens_only_from_its_button(app, page):
    ws = app.post('workspace', title='מרחב')['id']
    conversation = app.post('conversation', title='חקירה ראשונה')['id']
    app.post('message', content='שיחה ראשונה על ריכוז', conversationId=conversation, workspaceId=ws, extractRules=False)
    page.reload(); page.wait_for_selector('#draft')
    drawer, top = page.locator('.conversation-drawer'), page.locator('header.topbar')
    page.mouse.move(700, 400); page.mouse.move(1399, 400); page.wait_for_timeout(300)
    assert drawer.count() == 0  # no hover opening
    top.get_by_role('button', name='שיחות').click()
    expect(drawer).to_be_visible()
    box = drawer.bounding_box()
    assert box['x'] + box['width'] >= 1399  # right side in Hebrew
    page.mouse.move(700, 400); page.wait_for_timeout(200)
    assert drawer.count() == 1  # stays open when the pointer leaves
    expect(drawer.get_by_text('שיחה ראשונה על ריכוז')).to_be_visible()
    drawer.get_by_role('button', name='＋ שיחה חדשה').click()
    expect(page.locator('section.chat article.message')).to_have_count(0)
    send(page, 'הודעה בשיחה החדשה')
    top.get_by_role('button', name='שיחות').click()
    drawer.get_by_text('שיחה ראשונה על ריכוז').click()
    chat = page.locator('section.chat')
    expect(chat.get_by_text('שיחה ראשונה על ריכוז')).to_have_count(1)
    expect(chat.get_by_text('הודעה בשיחה החדשה')).to_have_count(0)
    top.get_by_role('button', name='שיחות').click()
    expect(drawer).to_be_visible()
    page.locator('.map-scroll').click(position={'x': 200, 'y': 200})
    expect(drawer).to_have_count(0)  # an outside click closes it


def test_focus_mode_and_drawing_zoom(app, page):
    app.post('workspace', title='מרחב')
    page.reload(); page.wait_for_selector('#draft')
    top = page.locator('header.topbar')
    before = page.locator('section.floating-window').evaluate_all('els=>els.map(e=>e.getAttribute("style"))')
    top.get_by_label('הלוחות על כל המסך').click()
    page.wait_for_timeout(300)
    boxes = page.locator('section.floating-window').evaluate_all('els=>els.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})')
    assert not top.is_visible()
    assert abs(sum(b[2] for b in boxes) - 1400) < 4 and all(b[1] < 2 and b[3] > 790 for b in boxes)
    page.keyboard.press('Escape'); page.wait_for_timeout(300)
    assert top.is_visible()
    assert page.locator('section.floating-window').evaluate_all('els=>els.map(e=>e.getAttribute("style"))') == before
    top.get_by_label('הלוחות על כל המסך').click()
    page.get_by_role('button', name='יציאה ממסך מלא').click()
    expect(top).to_be_visible()
    # Drawing zoom, drawing while zoomed, pan mode, wheel, reset.
    draw = page.locator('section.drawing-section')
    canvas, level = draw.locator('svg.drawing-canvas'), draw.get_by_label('חזרה לגודל רגיל')
    draw.get_by_label('הגדלת התצוגה').click(); draw.get_by_label('הגדלת התצוגה').click()
    expect(level).to_have_text('156%')
    box = canvas.bounding_box(); cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    page.mouse.move(cx, cy); page.mouse.down(); page.mouse.move(cx + 40, cy + 20, steps=5); page.mouse.up()
    expect(canvas.locator('polyline')).to_have_count(1)
    draw.get_by_role('button', name='✋ הזזה').click()
    view = canvas.get_attribute('viewBox')
    page.mouse.move(cx, cy); page.mouse.down(); page.mouse.move(cx - 80, cy - 50, steps=5); page.mouse.up()
    assert canvas.get_attribute('viewBox') != view
    expect(canvas.locator('polyline')).to_have_count(1)  # panning does not draw
    page.mouse.move(cx, cy); page.mouse.wheel(0, 300); page.wait_for_timeout(200)
    assert int(level.inner_text()[:-1]) < 156
    level.click()
    assert canvas.get_attribute('viewBox') == '0 0 600 700'


def test_empty_workspace_picker(app, page):
    picker = page.get_by_label('בחרי מרחב')
    expect(picker).to_be_disabled()
    expect(picker).to_contain_text('אין עדיין מרחב')
    picker.click(force=True); page.wait_for_timeout(300)
    assert page.locator('[role=listbox]').count() == 0
    assert page.evaluate('getComputedStyle(document.body).overflow') != 'hidden'
