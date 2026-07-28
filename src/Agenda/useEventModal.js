import { useState } from 'react';

let useEventModal = () => {
    const [modal, setModal] = useState({ id: '', type: '', show: false });

    const closeModal = () => {
        setModal({ id: '', type: '', show: false });
    };

    const showModal = (id, type) => {
        setModal({ id, type, show: true });
    };

    return { modal, showModal, closeModal };
};

export default useEventModal;
