import { makeAutoObservable } from 'mobx'

export type Popup = { kind: 'share' } | { kind: 'save'; image: string } | null

/** What's open and shown around the board: the sidebar's sections, the popup, saved images. */
export class UiStore {
  sidebarOpen = true
  palettesOpen = false
  sizesOpen = false
  backgroundsOpen = false
  popup: Popup = null
  /** PNG data URLs from Save, newest first. */
  saved: string[] = []

  constructor() {
    makeAutoObservable(this)
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen
  }

  togglePalettes() {
    this.palettesOpen = !this.palettesOpen
  }

  toggleSizes() {
    this.sizesOpen = !this.sizesOpen
  }

  toggleBackgrounds() {
    this.backgroundsOpen = !this.backgroundsOpen
  }

  showShare() {
    this.popup = { kind: 'share' }
  }

  showSaved(image: string) {
    this.saved.unshift(image)
    this.popup = { kind: 'save', image }
  }

  closePopup() {
    this.popup = null
  }
}

export const uiStore = new UiStore()
