import * as moment from 'moment';
import Modal from "react-bootstrap/Modal";

let ViewModel = (props ) => {
    return(
        <div>
            <Modal.Header closeButton>
                <Modal.Title>View Agenda</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p className='model-content'><b>Id: </b>{props.data.id}</p>
                <p className='model-content'><b>Name:</b> {props.data.title}</p>
                <p className='model-content'><b>Description:</b> {props.data.description}</p>
                <p className='model-content'><b>Date:</b> {moment(props.data.date).format('DD/MM/YYYY')}</p>
            </Modal.Body>
            <Modal.Footer>
                <button className="btn-agenda" onClick={props.handleClose}>
                    Close
                </button>
            </Modal.Footer>
        </div>
    );
}

export default ViewModel;