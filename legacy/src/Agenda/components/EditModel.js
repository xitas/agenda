import React, { useState } from 'react';
import Modal from "react-bootstrap/Modal";
import DatePicker from "react-datepicker";

let EditModel = ({data, handleClose , handleEditEvent , msgError, formError}) => {
    const [form, setForm] = useState({ title: data.title, description: data.description, date: data.date });

    return(
        <div>
            <Modal.Header closeButton>
                <Modal.Title>Edit Agenda</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p className='model-content'><b>Id: </b>{data.id}</p>
                {formError ? <p className='msg-error'>{formError}</p> : ""}
                <div className='editEvents'>
                    <div className='title'>
                        <input
                            type="text"
                            placeholder="Add title"
                            value={form.title}
                            onChange = {(e) => setForm({ ...form, title: e.target.value })}
                        />
                        {(msgError.err && msgError.title) ? <p className='msg-error'>Title must not be empty</p> : ""}
                    </div>
                    <div className='title'>
                        <textarea
                            placeholder="Add Description"
                            value={form.description}  rows={5}
                            onChange = {(e) => setForm({ ...form, description: e.target.value })}
                        ></textarea>
                    </div>
                    <div className='date'>
                        <DatePicker
                            placeholderText='Date'
                            selected={form.date}
                            onChange={ (date) => setForm({ ...form, date }) }
                        />
                        {(msgError.err &&  msgError.date) ? <p className='msg-error'>Date must not be empty</p> : ""}
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button className='btn-agenda btn-add' onClick={() => handleEditEvent({ ...form, id: data.id })}>Edit</button>
                <button className="btn-agenda" onClick={handleClose}>Close</button>
            </Modal.Footer>
        </div>
    );
}

export default EditModel;