import React from 'react';
import Modal from "react-bootstrap/Modal";
import DatePicker from "react-datepicker";

let EditModel = ({data, handleClose , handleEditEvent , msgError}) => {
    return(
        <div>
            <Modal.Header closeButton>
                <Modal.Title>Edit Agenda</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p className='model-content'><b>Id: </b>{data.id}</p>
                <div className='editEvents'>
                    <div className='title'>
                        <input 
                            type="text" 
                            placeholder="Add title" 
                            defaultValue={data.title} 
                            onChange = {(e) => { 
                                data['title'] = e.target.value;
                            }}     
                        />
                        {(msgError.err && msgError.title) ? <p className='msg-error'>Title must not be empty</p> : ""}
                    </div>
                    <div className='title'>
                        <textarea 
                            placeholder="Add Description" 
                            defaultValue={data.description}  rows={5}
                            onChange = {(e) => { 
                                data['description'] = e.target.value;
                            }}  
                        ></textarea>
                    </div>
                    <div className='date'>
                        <DatePicker 
                            placeholderText='Date' 
                            selected={data.date} 
                            onChange={ (date) => { 
                                    data['date'] = date;
                                }
                            }  
                        />
                        {(msgError.err &&  msgError.date) ? <p className='msg-error'>Date must not be empty</p> : ""}
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button className='btn-agenda btn-add' onClick={() => handleEditEvent(data)}>Edit</button> 
                <button className="btn-agenda" onClick={handleClose}>Close</button>
            </Modal.Footer>
        </div>
    );
}

export default EditModel;