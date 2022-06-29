import React from 'react';
import Modal from "react-bootstrap/Modal";

let DeleteModel = (props ) => {
    return(
        <div>
            <Modal.Header closeButton>
                <Modal.Title>Delete Agenda</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p className='model-content'>Are you sure you want to delete<b> {props.data.title}</b></p>
            </Modal.Body>
            <Modal.Footer>
                <button className="btn-agenda btn-del" onClick={() => props.handleDeleteEvent(props.data.id)}>
                    Delete
                </button>
                <button className="btn-agenda" onClick={props.handleClose}>
                    Close
                </button>
            </Modal.Footer>
        </div>
    );
}

export default DeleteModel;