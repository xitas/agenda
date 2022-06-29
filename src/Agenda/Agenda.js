import React, { useEffect, useState } from 'react';
import './Agenda.css';
import { nanoid } from 'nanoid';
import Modal from "react-bootstrap/Modal";
import CreateTable from './components/CreateTable';
import AddModel from './components/AddModel';
import ViewModel from './components/ViewModel';
import EditModel from './components/EditModel';
import DeleteModel from './components/DeleteModel';
import NotFoundModel from './components/NotFoundModel';

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
    
    //close model function
    const handleClose = () => {
        setModelState({id: "", type: "", show: false});
    }

    //model show function
    const handleShow = (id , type) => {
        setModelState({id: id, type: type, show: true});
    }

    //add new event in state
    let handleAddEvent = () =>{
        if(newEvent.id){
            const updateEvent = [...allEvent , newEvent];
            setAllEvent (updateEvent);
            setNewEvent({id: "" , title: "", description: "", date: ""});
        }
    }

    //close add model on adding record
    useEffect(() => {
        handleClose();
    }, [ allEvent ]);

    // delete an event in state
    let handleDeleteEvent = (id) => {
        handleClose();
        if(id){
            const updateEvent = allEvent.filter((event) => event.id !== id);
            setAllEvent (updateEvent);
        }
    }

    //set id on add
    let handleAddIdEvent = () => {
        setNewEvent({id: nanoid()})
    }

    //wait for id set then call add model
    useEffect(() => {
        if(newEvent.id){
            handleShow(newEvent.id , "add");
        }
    }, [newEvent.id]);

    //load model according to selected action 
    let GetModel = () => {
        if(ModelState.id){
            if(ModelState.type === "add"){
                return(
                    <AddModel
                    newEvent={newEvent} 
                    setNewEvent={setNewEvent} 
                    handleAddEvent={handleAddEvent} 
                    handleClose={handleClose}
                    id={ModelState.id}
                    /> 
                );
            }
            let agenda = allEvent.find(agenda => agenda.id === ModelState.id);
            let index = allEvent.findIndex(({ id }) => id === ModelState.id);
            if (ModelState.type === "view"){
                return(
                    <ViewModel 
                        data={agenda}
                        handleClose={handleClose}
                    />    
                );
            }
            if (ModelState.type === "edit"){
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
                <NotFoundModel 
                    handleClose={handleClose} 
                />
            );
        }
    }

    return(
        <div className='agenda'>
            <h1>Agenda</h1>
                <div className='agendas'>
                    <button className='btn-agenda' onClick={handleAddIdEvent} >Add</button>
                    <CreateTable 
                        allEvent={allEvent}
                        handleShow={handleShow}
                    />
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