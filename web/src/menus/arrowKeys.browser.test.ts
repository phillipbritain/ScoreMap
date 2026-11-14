import { afterEach, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { focusFirst, moveByArrows } from './arrowKeys'

let menu: HTMLElement

/** A menu of a search, a box for a note, three buttons (the middle one disabled) and a section that can't be used. */
function openMenu(): HTMLElement {
  menu = document.createElement('div')
  menu.innerHTML = `
    <input type="search" aria-label="Search">
    <textarea aria-label="Note"></textarea>
    <button type="button">One</button>
    <button type="button" disabled>Off</button>
    <div inert><button type="button">Inert</button></div>
    <button type="button">Two</button>
  `
  menu.addEventListener('keydown', (event) => moveByArrows(event, menu))
  document.body.append(menu)
  return menu
}
const control = (name: string) => [...menu.querySelectorAll<HTMLElement>('input, textarea, button')].find((el) => (el.textContent || el.getAttribute('aria-label')) === name)!

afterEach(() => menu?.remove())

it('moves through the controls that can be used, in order, with the arrows, Home and End', async () => {
  openMenu()
  control('One').focus()

  await userEvent.keyboard('{ArrowDown}')
  expect(document.activeElement).toBe(control('Two'))
  await userEvent.keyboard('{ArrowDown}')
  expect(document.activeElement).toBe(control('Two'))
  await userEvent.keyboard('{Home}')
  expect(document.activeElement).toBe(control('Search'))
  await userEvent.keyboard('{ArrowDown}')
  expect(document.activeElement).toBe(control('Note'))
  control('One').focus()
  await userEvent.keyboard('{End}')
  expect(document.activeElement).toBe(control('Two'))
  await userEvent.keyboard('{ArrowUp}')
  expect(document.activeElement).toBe(control('One'))
  await userEvent.keyboard('{ArrowUp}')
  expect(document.activeElement).toBe(control('Note'))
})

it('leaves Home and End in a text box to move its cursor', async () => {
  openMenu()
  control('Search').focus()

  await userEvent.keyboard('abc{Home}')

  expect(document.activeElement).toBe(control('Search'))
  expect((control('Search') as HTMLInputElement).selectionStart).toBe(0)
})

it('leaves every arrow in a box for a note to move its cursor, down its lines', async () => {
  openMenu()
  control('Note').focus()

  await userEvent.keyboard('one{Enter}two{ArrowUp}{ArrowDown}{Home}')

  expect(document.activeElement).toBe(control('Note'))
  expect((control('Note') as HTMLTextAreaElement).selectionStart).toBe(4)
})

it('focuses the first control that can be used', () => {
  openMenu()
  control('Search').setAttribute('disabled', '')
  control('Note').setAttribute('disabled', '')

  focusFirst(menu)

  expect(document.activeElement).toBe(control('One'))
})
