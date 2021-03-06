import React from 'react';
import Modal from "react-bootstrap/Modal";

let ImportModel = ({handleClose, handleImportData, handleFileChange}) => {
    return(
        <div>
            <Modal.Header closeButton>
                <Modal.Title>Import Agendas</Modal.Title>
            </Modal.Header>
            <Modal.Body>
            <div className='file-model'>
                <label className='file-select btn-agenda'>
                    <b>Select Import File</b>
                    <input type="file" onChange={handleFileChange}/>
                </label>
            </div>
            </Modal.Body>
            <Modal.Footer>
                <button className='btn-agenda btn-add' onClick={handleImportData}>Import</button> 
                <button className="btn-agenda" onClick={handleClose}>Close</button>
            </Modal.Footer>
        </div>
    );
}

export default ImportModel;