import Modal from "react-bootstrap/Modal";
import DatePicker from "react-datepicker";

let EditModel = ({allEvent, index, handleClose}) => {
    return(
        <div>
            <Modal.Header closeButton>
                <Modal.Title>Edit Agenda</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p className='model-content'><b>Id: </b>{allEvent[index].title}</p>
                <div className='editEvents'>
                    <div className='title'>
                        <input type="text" placeholder="Add title" defaultValue={allEvent[index].title} 
                            onChange = {(e) => { 
                                allEvent[index]['title'] = e.target.value;
                            }}     
                        />
                    </div>
                    <div className='title'>
                        <textarea placeholder="Add Description" defaultValue={allEvent[index].description}  rows={5}
                            onChange = {(e) => { 
                                allEvent[index]['description'] = e.target.value;
                            }}  
                        ></textarea>
                    </div>
                    <div className='date'>
                        <DatePicker placeholderText='Date' selected={allEvent[index].date} 
                        onChange = {(date) => { 
                            allEvent[index]['date'] = date;
                        }}  
                        />
                    </div>
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

export default EditModel;