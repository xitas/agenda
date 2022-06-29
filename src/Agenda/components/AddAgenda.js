import DatePicker from "react-datepicker";
import { nanoid } from 'nanoid';

let AddAgenda = ({newEvent,setNewEvent,handleAddEvent}) => {
    return(
        <div>
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
        </div>
    );
}

export default AddAgenda;