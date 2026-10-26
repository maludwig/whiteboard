import { observer } from 'mobx-react-lite'
import { boardStore } from '../stores/boardStore'
import { uiStore } from '../stores/uiStore'

export const Popup = observer(function Popup() {
  const popup = uiStore.popup
  if (!popup) return null
  return (
    <div className="popup-backdrop" onClick={() => uiStore.closePopup()}>
      <div className="popup" role="dialog" aria-label={popup.kind === 'share' ? 'Sharing' : 'Save Image'} onClick={(e) => e.stopPropagation()}>
        {popup.kind === 'share' ? <ShareBody /> : <SaveBody image={popup.image} />}
        <button className="ok" onClick={() => uiStore.closePopup()}>
          OK
        </button>
      </div>
    </div>
  )
})

const ShareBody = observer(function ShareBody() {
  return (
    <>
      <h3>Sharing</h3>
      {boardStore.status === 'online' ? (
        <p>
          To share your whiteboard, simply send this link to your buddy!
          <br />
          <a href={boardStore.shareUrl}>{boardStore.shareUrl}</a>
        </p>
      ) : boardStore.status === 'connecting' ? (
        <p>Setting up your shared board…</p>
      ) : (
        <p>Couldn't share the board{boardStore.lastError ? `: ${boardStore.lastError}` : '.'}</p>
      )}
    </>
  )
})

function SaveBody({ image }: { image: string }) {
  return (
    <>
      <h3>Save Image</h3>
      <p>Tap or click the image to open it; right-click or long-press it to save.</p>
      <a href={image} target="_blank" rel="noreferrer" download="whiteboard.png">
        <img className="preview" src={image} alt="Your whiteboard" />
      </a>
    </>
  )
}
