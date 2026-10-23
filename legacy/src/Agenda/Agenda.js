import React, { useState } from 'react';
import './Agenda.css';
import Modal from "react-bootstrap/Modal";
import CreateTable from './components/CreateTable';
import AddModel from './components/AddModel';
import ViewModel from './components/ViewModel';
import EditModel from './components/EditModel';
import DeleteModel from './components/DeleteModel';
import ImportModel from './components/ImportModel';
import NotFoundModel from './components/NotFoundModel';
import useAgendaEvents from './useAgendaEvents';
import useEventModal from './useEventModal';

let Agenda = () => {
    const { events, loading, error, addEvent, editEvent, deleteEvent, importEvents } = useAgendaEvents();
    const { modal, showModal, closeModal } = useEventModal();

    const [newEvent, setNewEvent] = useState({ title: "", description: "", date: "" });
    const [msgError, setMsgError] = useState({ err: false, title: false, date: false });
    const [formError, setFormError] = useState("");
    const [file, setFile] = useState();

    const handleClose = () => {
        closeModal();
        setMsgError({ err: false, title: false, date: false });
        setFormError("");
        setNewEvent({ title: "", description: "", date: "" });
        setFile(undefined);
    }

    const handleAddEvent = async () => {
        const titleMissing = !newEvent.title;
        const dateMissing = !newEvent.date;
        if (titleMissing || dateMissing) {
            setMsgError({ err: true, title: titleMissing, date: dateMissing });
            return;
        }
        setMsgError({ err: false, title: false, date: false });
        const result = await addEvent(newEvent);
        if (result.ok) {
            handleClose();
        } else {
            setFormError(result.error);
        }
    }

    const handleEditEvent = async (data) => {
        const titleMissing = !data.title;
        const dateMissing = !data.date;
        if (titleMissing || dateMissing) {
            setMsgError({ err: true, title: titleMissing, date: dateMissing });
            return;
        }
        setMsgError({ err: false, title: false, date: false });
        const result = await editEvent(data);
        if (result.ok) {
            handleClose();
        } else {
            setFormError(result.error);
        }
    }

    const handleDeleteEvent = async (id) => {
        if (!id) {
            handleClose();
            return;
        }
        const result = await deleteEvent(id);
        if (result.ok) {
            handleClose();
        } else {
            setFormError(result.error);
        }
    }

    const handleExportData = () => {
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
            JSON.stringify(events)
        )}`;
        const link = document.createElement("a");
        link.href = jsonString;
        link.download = "AgendaData.json";
        link.click();
    }

    const handleImportData = () => {
        if (!file) {
            setFormError("Please select a file first");
            return;
        }
        const reader = new FileReader();
        reader.readAsText(file, "UTF-8");
        reader.onload = async (evt) => {
            let data;
            try {
                data = JSON.parse(evt.target.result);
            } catch (e) {
                setFormError("Could not import file — make sure it's a valid Agenda export.");
                return;
            }
            if (!Array.isArray(data)) {
                setFormError("Could not import file — make sure it's a valid Agenda export.");
                return;
            }
            const result = await importEvents(data);
            if (result.ok) {
                handleClose();
            } else {
                setFormError(result.error);
            }
        }
        reader.onerror = () => {
            setFormError("Error reading file");
        }
    }

    function handleFileChange(event) {
        setFile(event.target.files[0]);
    }

    //load model according to selected action
    let getModel = () => {
        if (modal.type === "add") {
            return (
                <AddModel
                    newEvent={newEvent}
                    setNewEvent={setNewEvent}
                    handleAddEvent={handleAddEvent}
                    handleClose={handleClose}
                    msgError={msgError}
                    formError={formError}
                />
            );
        }
        if (modal.type === "import") {
            return (
                <ImportModel
                    handleClose={handleClose}
                    handleImportData={handleImportData}
                    handleFileChange={handleFileChange}
                    formError={formError}
                />
            );
        }
        if (modal.type === "view" || modal.type === "edit" || modal.type === "del") {
            let agenda = events.find(event => event.id === modal.id);
            if (!agenda) {
                return <NotFoundModel handleClose={handleClose} />;
            }
            if (modal.type === "view") {
                return <ViewModel data={agenda} handleClose={handleClose} />;
            }
            if (modal.type === "edit") {
                return (
                    <EditModel
                        data={agenda}
                        handleClose={handleClose}
                        handleEditEvent={handleEditEvent}
                        msgError={msgError}
                        formError={formError}
                    />
                );
            }
            if (modal.type === "del") {
                return (
                    <DeleteModel
                        data={agenda}
                        handleClose={handleClose}
                        handleDeleteEvent={handleDeleteEvent}
                        formError={formError}
                    />
                );
            }
        }
        return null;
    }

    return (
        <div className='agenda'>
            <h1>Agenda</h1>
            <div className='agendas'>
                {error ? (
                    <p className='msg-error'>Could not reach the server: {error}</p>
                ) : (
                    <>
                        <div className='header-button'>
                            <div className='left'>
                                <button className='btn-agenda' onClick={() => showModal(null, "add")}>Add</button>
                            </div>
                            <div className='right'>
                                <button className='btn-agenda' onClick={handleExportData}>Export</button>
                                <button className='btn-agenda' onClick={() => showModal(null, "import")}>Import</button>
                            </div>
                        </div>
                        {loading ? (
                            <p>Loading agenda…</p>
                        ) : (
                            <CreateTable
                                allEvent={events}
                                handleShow={showModal}
                            />
                        )}
                        <div>
                            <Modal show={modal.show} onHide={handleClose}>
                                {getModel()}
                            </Modal>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default Agenda;
