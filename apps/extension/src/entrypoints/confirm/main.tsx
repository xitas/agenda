import { ConfirmAdd } from '../../ui/ConfirmAdd';
import { mount } from '../../ui/mount';

// The worker opened this window with ?id=, where it left the selected text.
void mount(<ConfirmAdd id={new URLSearchParams(window.location.search).get('id') ?? ''} />);
