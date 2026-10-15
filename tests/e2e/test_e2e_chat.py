"""Chat: the three reply buttons, map search, the model queue, the explanation screen,
the answer preference and the writing box."""
from playwright.sync_api import expect
from e2e_helpers import inside, send


def two_spaces(app):
    a = app.post('workspace', title='מרחב א')['id']
    b = app.post('workspace', title='מרחב ב')['id']
    app.post('conversation', title='שיחה')
    app.post('create-idea', workspaceId=a, title='ריכוז ותשומת לב')
    app.post('create-idea', workspaceId=b, title='שינה עמוקה')
    return a, b


def test_map_search_text_then_other_space_then_smart(app, page, fake_ollama):
    two_spaces(app)
    page.reload(); page.wait_for_selector('#draft')
    space = page.get_by_label('בחרי מרחב')
    # 1. Plain text search finds the idea in the current space and shows it.
    m = send(page, 'איפה הרעיון על ריכוז?')
    m.get_by_role('button', name='חיפוש במפה שלי').click()
    expect(m.get_by_text('נמצא במפה הנוכחית')).to_be_visible()
    page.wait_for_timeout(400)
    assert inside(page, page.locator('[data-idea-id]', has_text='ריכוז ותשומת לב'))
    # 2. Found only in another space: one click switches there and shows it.
    m = send(page, 'מה עם שינה?')
    m.get_by_role('button', name='חיפוש במפה שלי').click()
    m.get_by_role('button', name='שינה עמוקה · מעבר ל„מרחב ב”').click()
    expect(space).to_have_text('מרחב ב')
    page.wait_for_timeout(400)
    assert inside(page, page.locator('[data-idea-id]', has_text='שינה עמוקה'))
    # 3. No text match: offer the AI search, which finds a similar idea in its own space.
    m = send(page, 'קשב')
    m.get_by_role('button', name='חיפוש במפה שלי').click()
    m.get_by_role('button', name='לחפש בחיפוש חכם (AI) — גם רעיונות דומים?').click()
    expect(m.get_by_text('ריכוז קרוב לקשב.')).to_be_visible(timeout=15000)
    expect(space).to_have_text('מרחב א')
    page.wait_for_timeout(400)
    assert inside(page, page.locator('[data-idea-id]', has_text='ריכוז ותשומת לב'))
    assert fake_ollama.kinds() == ['search']  # text search used no model at all


def test_queue_cancel_stop_explanation_and_preference(app, page, fake_ollama):
    two_spaces(app)
    fake_ollama.delay = 0.8  # slow answers, so requests wait in line
    page.reload(); page.wait_for_selector('#draft')
    page.get_by_role('button', name='העדפת תשובה').click()
    page.get_by_placeholder('לדוגמה: תשובות קצרות וברורות, בלי מונחים מקצועיים').fill('תשובות קצרות מאוד')
    page.get_by_role('button', name='שמירה', exact=True).click()
    expect(page.get_by_role('button', name='העדפת תשובה ✓')).to_be_visible()

    m = send(page, 'קשב')
    m.get_by_role('button', name='יועץ חיצוני').click()
    page.wait_for_timeout(300)
    m.get_by_role('button', name='התייעצות עם עצמך').click()
    page.wait_for_timeout(300)
    m.get_by_role('button', name='חילוץ רעיונות, קשרים והקשר').click()
    queue = page.locator('.model-queue li')
    expect(queue).to_have_count(3, timeout=5000)
    rows = queue.all_inner_texts()
    assert 'פועל עכשיו' in rows[0] and all('ממתין בתור' in r for r in rows[1:])
    # The app keeps working while the model is busy.
    send(page, 'הודעה בזמן המתנה')
    # Cancel a waiting request: it never reaches the model and shows no error.
    queue.nth(1).get_by_role('button', name='ביטול').click()
    expect(queue).to_have_count(2, timeout=5000)
    expect(page.locator('.explanation-panel')).to_be_visible(timeout=20000)
    expect(page.locator('.explanation-panel').get_by_text('קשב סלקטיבי')).to_be_visible()
    expect(page.get_by_text('בדיקת החילוץ מהטקסט')).to_be_visible(timeout=20000)
    page.get_by_role('button', name='סגירה ללא שמירת העריכות').click()
    graph = app.graph()
    assert not any(r['mode'] == 'self' for r in graph['chat_replies'])
    assert 'self' not in fake_ollama.kinds()
    assert page.locator('.error[role=alert]').count() == 0
    external = next(e for e in fake_ollama.log if e['kind'] == 'external')
    assert 'תשובות קצרות מאוד' in external['system'] and external['stream'] is True
    assert len(graph['ideas']) == 2  # replies never become ideas
    # Stop a RUNNING request: the stream is closed and nothing is saved.
    last = page.locator('section.chat article.message').last
    last.get_by_role('button', name='התייעצות עם עצמך').click()
    expect(queue.first).to_contain_text('פועל עכשיו', timeout=5000)
    page.wait_for_timeout(900)
    queue.first.get_by_role('button', name='עצירה').click()
    expect(page.locator('.model-queue')).to_have_count(0, timeout=10000)
    page.wait_for_timeout(1500)
    assert not any(r['mode'] == 'self' for r in app.graph()['chat_replies'])
    assert [e for e in fake_ollama.log if e['kind'] == 'self'][-1].get('aborted') is True
    # A normal "consult yourself" reply appears, labeled as a mirror.
    fake_ollama.delay = 0.05
    last.get_by_role('button', name='התייעצות עם עצמך').click()
    expect(last.get_by_text('שיקוף · כמו להתייעץ עם עצמך')).to_be_visible(timeout=15000)


def test_writing_box_resize_and_hide(app, page):
    ws = app.post('workspace', title='מרחב')['id']
    conversation = app.post('conversation', title='חקירה ראשונה')['id']
    for n in range(6):
        app.post('message', content=f'הודעה מספר {n + 1} ' + 'מילה ' * 30, conversationId=conversation,
                 workspaceId=ws, extractRules=False)
    page.reload(); page.wait_for_selector('#draft')
    chat = page.locator('section.chat')
    assert chat.get_by_label('בחרי שיחה').count() == 0 and chat.locator('.section-heading').count() == 0
    messages, box = chat.locator('.messages'), page.locator('#draft')
    h0, b0 = messages.bounding_box()['height'], box.bounding_box()['height']
    grip = page.locator('.composer-grip').bounding_box()
    x, y = grip['x'] + grip['width'] / 2, grip['y'] + grip['height'] / 2
    page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x, y + 60, steps=5); page.mouse.up()
    assert box.bounding_box()['height'] < b0 - 40 and messages.bounding_box()['height'] > h0 + 40
    size = box.bounding_box()['height']
    page.reload(); page.wait_for_selector('#draft')
    assert abs(page.locator('#draft').bounding_box()['height'] - size) < 3  # remembered
    h1 = messages.bounding_box()['height']
    page.get_by_label('הסתרת תיבת הכתיבה').click()
    assert page.locator('#draft').count() == 0 and messages.bounding_box()['height'] > h1 + 80
    page.reload(); page.wait_for_selector('section.chat .messages')
    assert page.locator('#draft').count() == 0  # remembered
    page.get_by_role('button', name='כתיבת הודעה').click()
    expect(page.locator('#draft')).to_be_visible()
    send(page, 'בדיקה')
