import React, { useState } from 'react';
import './Agenda.css';
import * as moment from 'moment';
import { nanoid } from 'nanoid';
import DatePicker from "react-datepicker";
import Modal from "react-bootstrap/Modal";



const events = [
    {
        id : nanoid(),
        title: "Meeting",
        description: "Lorem ipsum dolor sit amet consectetur adipisicing elit. Debitis, repellat.",
        date: new Date(2022,6,0),
    },
    {
        id : nanoid(),
        title: "Vacation",
        description: "Lorem ipsum dolor sit amet consectetur adipisicing elit. Debitis, repellat.",
        date: new Date(2022,6,1),
    },
    {
        id : nanoid(),
        title: "Conference",
        description: "Lorem ipsum dolor sit amet consectetur adipisicing elit. Debitis, repellat.",
        date: new Date(2022,7,0),
    }
];



let Agenda = () => {
    const [newEvent, setNewEvent] = useState({id : "" , title: "", description: "", date: ""});
    const [allEvent, setAllEvent] = useState(events);
    // const [updateEvent, setUpdateEvent] = useState({id: "" , title: "", description: "", date: ""});

    // modal to show
    const [ModelState, setModelState] = useState({id: "" , type: "", show: false});
    
    const handleClose = () => {
        setModelState({id: "", type: "", show: false});
    }
    const handleShow = (id , type) => {
        setModelState({id: id, type: type, show: true});
    }

    //add new event in state
    let handleAddEvent = () =>{
        setNewEvent({id : nanoid()});
        if(newEvent.id){
            const updateEvent = [...allEvent , newEvent];
            setAllEvent (updateEvent);
            setNewEvent({id: "" , title: "", description: "", date: ""});
        }
    }

    let handleDeleteEvent = (id) => {
        handleClose();
        if(id){
            const updateEvent = allEvent.filter((event) => event.id !== id);
            setAllEvent (updateEvent);
        }
    }

    let handleUpdate = (e) => {
        e.preventDefault();
        // const fieldName = e.target.getAttribute("name"); 
        const fieldValue = e.target.value;

        console.log(fieldValue);
        
    }

    let GetModel = () => {
        if(ModelState.id){
            let agenda = allEvent.find(agenda => agenda.id === ModelState.id);
            if (ModelState.type === "view"){
                return(
                    <div>
                        <Modal.Header closeButton>
                            <Modal.Title>View Agenda</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <p className='model-content'><b>Id: </b>{agenda.id}</p>
                            <p className='model-content'><b>Name:</b> {agenda.title}</p>
                            <p className='model-content'><b>Description:</b> {agenda.description}</p>
                            <p className='model-content'><b>Date:</b> {moment(agenda.date).format('DD/MM/YYYY')}</p>
                        </Modal.Body>
                        <Modal.Footer>
                            <button className="btn-agenda" onClick={handleClose}>
                                Close
                            </button>
                        </Modal.Footer>
                    </div>
                );
            }
            if (ModelState.type === "edit"){
                return(
                    <div>
                        <Modal.Header closeButton>
                            <Modal.Title>Edit Agenda</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <p className='model-content'><b>Id: </b>{agenda.id}</p>
                            <div className='editEvents'>
                                <div className='title'>
                                    <input type="text" placeholder="Add title" value={agenda.title} 
                                        onChange = {(e) => handleUpdate(e)}   
                                    />
                                </div>
                                <div className='title'>
                                    <textarea placeholder="Add Description" value={agenda.description} rows={5}
                                   onChange = {(e) => agenda.description = e.target.value }  
                                    ></textarea>
                                </div>
                                <div className='date'>
                                    <DatePicker placeholderText='Date' selected={agenda.date} 
                                    // onChange={ (date) => setUpdateEvent( {...updateEvent, date} ) }
                                    />
                                </div>
                                {/* <button className='btn-agenda' onClick={handleAddEvent}>Add Event</button> */}
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <button className="btn-agenda" onClick={handleClose}>
                                Close
                            </button>
                        </Modal.Footer>
                    </div>
                );
            }
            if (ModelState.type === "del"){
                return(
                    <div>
                        <Modal.Header closeButton>
                            <Modal.Title>Delete Agenda</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <p className='model-content'>Are you sure you want to delete<b> {agenda.title}</b></p>
                        </Modal.Body>
                        <Modal.Footer>
                            <button className="btn-agenda btn-del" onClick={() => handleDeleteEvent(agenda.id)}>
                                Delete
                            </button>
                            <button className="btn-agenda" onClick={handleClose}>
                                Close
                            </button>
                        </Modal.Footer>
                    </div>
                );
            }
        }else{
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
    }

    return(
        <div className='agenda'>
            <h1>Agenda</h1>
            <h2>Add New Events</h2>
            <div className='addEvents'>
                <div className='title'>
                    <input type="text" placeholder="Add title" value={newEvent.title} 
                    onChange = {(e) => setNewEvent({...newEvent, title: e.target.value})} />
                </div>
                <div className='title'>
                    <textarea placeholder="Add Description" value={newEvent.description} rows={5}
                    onChange = {(e) => setNewEvent({...newEvent, description: e.target.value})} ></textarea>
                </div>
                <div className='date'>
                    <DatePicker placeholderText='Date' selected={newEvent.date} 
                    onChange={ (date) => setNewEvent( {...newEvent, date , id: nanoid()} ) } />
                </div>
                <button className='btn-agenda' onClick={handleAddEvent}>Add Event</button>
            </div>
            <div className='agendas'>
                <table className='table-agendas'>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th style={{width:"60%"}}>Agenda</th>
                            <th>Date</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allEvent.map((event) => (
                            <tr key={event.id} >
                                <td>{event.id}</td>
                                <td>{event.title}</td>
                                <td>{moment(event.date).format('DD/MM/YYYY')}</td>
                                <td>
                                    <button className='btn-agenda' onClick={() => handleShow(event.id , "view")}>View</button>
                                    <button className='btn-agenda' onClick={() => handleShow(event.id , "edit")}>Edit</button>
                                    <button className='btn-agenda' onClick={() => handleShow(event.id , "del")}>Del</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div>
                    <Modal show={ModelState.show} onHide={handleClose}>
                        {GetModel()}
                    </Modal>
                </div>
            </div>
        </div>
    );
}

export default Agenda;