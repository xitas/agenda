import React, { useState } from 'react';
import './Agenda.css';
import * as moment from 'moment';
import { nanoid } from 'nanoid';
import DatePicker from "react-datepicker";
import Modal from "react-bootstrap/Modal";
import ViewModel from './components/ViewModel';
import EditModel from './components/EditModel';
import DeleteModel from './components/DeleteModel';

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

    // delete an event in state
    let handleDeleteEvent = (id) => {
        handleClose();
        if(id){
            const updateEvent = allEvent.filter((event) => event.id !== id);
            setAllEvent (updateEvent);
        }
    }

    //load model according to selected action 
    let GetModel = () => {
        if(ModelState.id){
            let agenda = allEvent.find(agenda => agenda.id === ModelState.id);
            let index = allEvent.findIndex(({ id }) => id === ModelState.id);
            console.log(index);
            if (ModelState.type === "view"){
                return(
                    <ViewModel 
                        data={agenda}
                        handleClose={handleClose}
                    />    
                );
            }
            if (ModelState.type === "edit"){
                console.log(allEvent);
                return(
                    <EditModel 
                        index={index} 
                        allEvent={allEvent}
                        handleClose={handleClose}
                    />
                );
            }
            if (ModelState.type === "del"){
                return(
                    <DeleteModel 
                        data={agenda}
                        handleClose={handleClose} 
                        handleDeleteEvent={handleDeleteEvent}
                    />
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