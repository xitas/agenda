import React from 'react';
import * as moment from 'moment';

let CreateTable = ({allEvent , handleShow}) => {
    return(
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
    );
}

export default CreateTable;