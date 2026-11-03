import { browser } from 'wxt/browser';
import { mount } from '../../ui/mount';
import { Popup } from '../../ui/Popup';

// Looked up first: Chrome opens the side panel only straight from the click, and an
// await inside the click handler could lose that.
const { id: windowId } = await browser.windows.getCurrent();

void mount(
  <Popup
    {...(windowId === undefined
      ? {}
      : {
          openSidePanel: () => {
            void browser.sidePanel.open({ windowId });
          },
        })}
  />,
);
