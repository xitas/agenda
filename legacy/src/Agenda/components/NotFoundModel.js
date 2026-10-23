import React from 'react';
import Modal from "react-bootstrap/Modal";

let NotFoundModel = ({handleClose}) => {
    return(
        <div>
            <Modal.Header closeButton>
                <Modal.Title>404 Agenda</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>No Id Found</p>
            </Modal.Body>
            <Modal.Footer>
                <button className="btn-agenda" onClick={handleClose}>
                    Close
                </button>
            </Modal.Footer>
        </div>
    );
}

export default NotFoundModel;