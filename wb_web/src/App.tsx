import { observer } from 'mobx-react-lite'
import { useEffect } from 'react'
import { BoardCanvas } from './components/BoardCanvas'
import { Popup } from './components/Popup'
import { Sidebar } from './components/Sidebar'
import { browserNav } from './nav'
import { boardStore } from './stores/boardStore'

const App = observer(function App() {
  useEffect(() => {
    void boardStore.start()

    // The URL says which board this is. If it changes under us (Back, Forward,
    // a pasted link), start over from the new URL rather than switch in place.
    const onUrlChange = () => {
      if (browserNav.hash() !== (boardStore.hash ?? '')) browserNav.reload()
    }
    // z / y, as the old page had, plus the usual Ctrl/Cmd shortcuts.
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const undo = key === 'z' && !e.shiftKey
      const redo = key === 'y' || (key === 'z' && e.shiftKey && (e.ctrlKey || e.metaKey))
      if (undo) boardStore.undo()
      else if (redo) boardStore.redo()
      else return
      e.preventDefault()
    }
    window.addEventListener('popstate', onUrlChange)
    window.addEventListener('hashchange', onUrlChange)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('popstate', onUrlChange)
      window.removeEventListener('hashchange', onUrlChange)
      window.removeEventListener('keydown', onKey)
      boardStore.stop()
    }
  }, [])

  return (
    <>
      <BoardCanvas />
      <Sidebar />
      <Popup />
    </>
  )
})

export default App
