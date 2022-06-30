import React from 'react';
import Modal from "react-bootstrap/Modal";
import DatePicker from "react-datepicker";

let AddModel = ({newEvent,setNewEvent,handleAddEvent,handleClose,msgError}) => {
    return(
        <div>
            <Modal.Header closeButton>
                <Modal.Title>Add New Agenda</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className='addEvents'>
                     <div className='title'>
                        <input type="text" placeholder="Add title" value={newEvent.title} 
                        onChange = {(e) => setNewEvent({...newEvent, title: e.target.value})
                        }
                        />
                        {(msgError.err && !newEvent.title) ? <p className='msg-error'>Title must not be empty</p> : ""}
                    </div>
                    <div className='title'>
                        <textarea placeholder="Add Description" value={newEvent.description} rows={5}
                        onChange = {(e) => setNewEvent({...newEvent, description: e.target.value})} ></textarea>
                    </div>
                    <div className='date'>
                        <DatePicker placeholderText='Date' selected={newEvent.date} 
                        onChange={ (date) => setNewEvent( {...newEvent, date} ) } />
                        {(msgError.err && !newEvent.date) ? <p className='msg-error'>Date must not be empty</p> : ""}
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button className='btn-agenda btn-add' onClick={handleAddEvent}>Add</button> 
                <button className="btn-agenda" onClick={handleClose}>Close</button>
            </Modal.Footer>
        </div>
    );
}

export default AddModel;