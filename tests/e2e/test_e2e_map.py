"""After approving an extraction, the map shows the new ideas (desktop and phone)."""
from playwright.sync_api import expect
from e2e_helpers import inside, send


def seed_many_ideas(app):
    ws = app.post('workspace', title='מרחב')['id']
    app.post('conversation', title='שיחה')
    for n in range(30):  # many ideas, so new ones would land far outside the initial view
        app.post('create-idea', workspaceId=ws, title=f'רעיון קיים {n + 1}')


def approve_extraction(tab):
    expect(tab.get_by_text('בדיקת החילוץ מהטקסט')).to_be_visible(timeout=20000)
    tab.get_by_text('אישור ושמירת הפריטים שנבחרו').click()


def new_ideas(tab, before):
    return tab.locator('[data-idea-id]').evaluate_all(
        '(els,b)=>els.filter(e=>!b.includes(e.getAttribute("data-idea-id"))).map(e=>e.getAttribute("data-idea-id"))', before)


def test_desktop_frames_new_ideas(app, page):
    seed_many_ideas(app)
    page.reload(); page.wait_for_selector('#draft')
    before = page.locator('[data-idea-id]').evaluate_all('els=>els.map(e=>e.getAttribute("data-idea-id"))')
    page.fill('#draft', 'אני משערת שהליכה תורמת לריכוז.')
    page.get_by_text('שמירה וחילוץ חכם').click()
    approve_extraction(page)
    expect(page.locator('[data-idea-id]')).to_have_count(len(before) + 2)
    page.wait_for_timeout(600)
    ids = new_ideas(page, before)
    assert len(ids) == 2
    assert all(inside(page, page.locator(f'[data-idea-id="{i}"]')) for i in ids)


def test_phone_switches_to_map_and_frames(app, phone):
    seed_many_ideas(app)
    phone.goto(app.url + '/'); phone.wait_for_selector('#draft', state='attached')
    phone.select_option('select[aria-label="מסך בנייד"]', 'chat')
    before = phone.locator('[data-idea-id]').evaluate_all('els=>els.map(e=>e.getAttribute("data-idea-id"))')
    phone.fill('#draft', 'אני משערת שהליכה תורמת לריכוז.')
    phone.get_by_text('שמירה וחילוץ חכם').click()
    approve_extraction(phone)
    expect(phone.locator('select[aria-label="מסך בנייד"]')).to_have_value('map')
    phone.wait_for_timeout(800)
    ids = new_ideas(phone, before)
    assert len(ids) == 2
    assert all(inside(phone, phone.locator(f'[data-idea-id="{i}"]')) for i in ids)
