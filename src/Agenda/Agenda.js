import React, { useEffect, useState } from 'react';
import './Agenda.css';
import { nanoid } from 'nanoid';
import Modal from "react-bootstrap/Modal";
import CreateTable from './components/CreateTable';
import AddModel from './components/AddModel';
import ViewModel from './components/ViewModel';
import EditModel from './components/EditModel';
import DeleteModel from './components/DeleteModel';
import ImportModel from './components/ImportModel';
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
    // set events
    const [newEvent, setNewEvent] = useState({id : "" , title: "", description: "", date: ""});
    const [updateEvent, setUpdateEvent] = useState({id : "" , title: "", description: "", date: ""});
    const [allEvent, setAllEvent] = useState(events);

    //error msg state
    const [msgError, setMsgError] = useState({err: false, title: false, date: false,});

    // modal to show
    const [ModelState, setModelState] = useState({id: "" , type: "", show: false});
    
    //file state
    const [file, setFile] = useState();
    
    //close model function 
    const handleClose = () => {
        setModelState({id: "", type: "", show: false});
        setMsgError(false);
    }

    //model show function
    const handleShow = (id , type) => {
        setModelState({id: id, type: type, show: true});
    }

    let addValidation = () => {
        if(!newEvent.id){
            return false;
        }
        if (!newEvent.title){
            return false;
        }
        if(!newEvent.date){
            return false;
        }
        return true;
    }

    //add new event in state
    let handleAddEvent = () =>{
        if(addValidation()){
            const updateEvent = [...allEvent , newEvent];
            setAllEvent (updateEvent);
            setNewEvent({id: "" , title: "", description: "", date: ""});
        }else{
            setMsgError({err: true});
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

    let handleEditEvent = (data) => {
        if(data.title !== '' && data.date  !== null) {
            let index = allEvent.findIndex(({ id }) => id === data.id);
            allEvent[index].title = data.title;
            allEvent[index].description = data.description;
            allEvent[index].date = data.date;
            handleClose();
        }else{
            if(data.title === ''){
                setMsgError({err : true, title : true});
            }
            if(data.date  === ''){
                setMsgError({err : true, date : true});
            }
            console.log("Got Error!");
        }
    }

    let handleExportData = () => {
        // console.log(allEvent);
        const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
            JSON.stringify(allEvent)
          )}`;
          const link = document.createElement("a");
          link.href = jsonString;
          link.download = "AgendaData.json";
          link.click();
    }

    let handleImportData = () => {
        let reader = new FileReader();
        reader.readAsText(file, "UTF-8");
        reader.onload = function (evt) {
            let data = JSON.parse(evt.target.result);
            data.map( (agenda) => (
                agenda.date = new Date(agenda.date)
            ));
            console.log(data)
            const updateEvent = [...allEvent , ...data];
            setAllEvent (updateEvent);
        }
        reader.onerror = function (evt) {
          console.log("Error reading file");
        }
    }

    function handleFileChange(event) {
        setFile(event.target.files[0]);
    }

    //load model according to selected action 
    let getModel = () => {
        if(ModelState.id){
            if(ModelState.type === "add"){
                return(
                    <AddModel
                    newEvent={newEvent} 
                    setNewEvent={setNewEvent} 
                    handleAddEvent={handleAddEvent} 
                    handleClose={handleClose}
                    msgError={msgError}
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
                let data = JSON.parse(JSON.stringify(allEvent[index]));
                data.date = new Date(data.date);
                return(
                    <EditModel 
                        data={data}
                        handleClose={handleClose}
                        handleEditEvent={handleEditEvent}
                        msgError={msgError}
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
        }else if( ModelState.type === "import" ){
            return(
                <ImportModel 
                    handleClose={handleClose} 
                    handleImportData={handleImportData}
                    handleFileChange={handleFileChange}
                />
            );
        }else{
            return(
                <NotFoundModel handleClose={handleClose} />
            );
        }
    }

    return(
        <div className='agenda'>
            <h1>Agenda</h1>
                <div className='agendas'>
                    <div className='header-button'>
                        <div className='left'>
                            <button className='btn-agenda' onClick={handleAddIdEvent} >Add</button>
                        </div>
                        <div className='right'>
                            <button className='btn-agenda' onClick={handleExportData}>Export</button>
                            <button className='btn-agenda' onClick={() => handleShow( null , "import")}>Import</button>
                        </div>

                    </div>
                    <CreateTable 
                        allEvent={allEvent}
                        handleShow={handleShow}
                    />
                    <div>
                    <Modal show={ModelState.show} onHide={handleClose}>
                        {getModel()}
                    </Modal>
                </div>
            </div>
        </div>
    );
}

export default Agenda;