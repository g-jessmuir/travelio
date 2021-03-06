var weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
];
/*
5. send link to other people
6. those people pick dates as well
*/

/*
    - split costs functionality
    - move buttons at bottom to somewhere else
    - 'add event' popup ui
        - travel
        - accomodations
        - custom
    - hosting (GCP)
        - integrating websockets
    - making it look pretty
*/
var events = [];

var budgetItems = [];

var people = [];

var startDate;
var endDate;

var dayDisplayOffset = 0;

var totalCost = 0;

var gottenHotels;
var gottenFlights;

var nextEventDay = 0;
var local_name = '';

let x = () => {
    if(destination !== ''){
        document.getElementById('landing-page').style.display = "none";
    }
}

x();

function setNextEventDay(i) { nextEventDay = i; }

let createWs = () => {
    var scheme = window.location.protocol == "https:" ? 'wss://' : 'ws://';
    var webSocketUri =  scheme
                        + window.location.hostname
                        + (location.port ? ':'+location.port: '');
    return new WebSocket(webSocketUri);
}

var ws = createWs();

function leaveLanding(e) {
    e.preventDefault();
    destination = document.getElementById('destinationLocation').value;
    document.getElementById('destination-text').innerHTML = 
        destination[0].toUpperCase() + destination.substring(1, destination.length).toLowerCase();
    $('#landing-page').animate({
        'top': '-=100%'
    }, 1000);
    $('#landing-page').fadeOut(400);

    $.post({
        url: "/setDestination",
        data: {
            'destination': destination
        },
        success: (e) =>{
            console.log(e)
        }
    })
}

$(function() {
    $('input[name="daterange"]').daterangepicker({
        opens: 'left'
    }, function(start, end, label) {
        let n = document.getElementById('inputFieldName').value;
        let e = moment(end);
        e.hour(0);
        e.minute(0);
        e.second(0);
        e.millisecond(0);
        saveInputParams(n, start, e);
    });
});

function saveInputParams(n, start, end) {
    let setPerson = true;
    for (let i = 0; i < people.length; i++) {
        if (people[i].name == n) {
            people[i].aStart = start;
            people[i].aEnd = end;
            setPerson = false;
        }
    }
    if (setPerson) {
        people.push({name: n, aStart: start, aEnd: end});
        local_name = n;
        var tempPeople = people
        tempPeople[0].aStart = moment(tempPeople[0].aStart).format('YYYY-MM-DD,HH:mm:ss.sssZZ')
        tempPeople[0].aEnd = moment(tempPeople[0].aEnd).format('YYYY-MM-DD,HH:mm:ss.sssZZ')
        ws.send(JSON.stringify({'type': 'userList', 'data': tempPeople}))
        console.log(tempPeople)
    }
    console.log(people)
}

function calcAvailability() {
    console.log(people)
    let startDates = [];
    let endDates = [];
    for (let i = 0; i < people.length; i++) {
        startDates.push(moment(people[i].aStart, 'YYYY-MM-DD,HH:mm:ss.sssZZ'));
        endDates.push(moment(people[i].aEnd, 'YYYY-MM-DD,HH:mm:ss.sssZZ'));
    }
    startDate = moment.max(startDates);
    endDate = moment.min(endDates);
    let tripLength = moment.duration(endDate.diff(startDate)).days();
    events = [];
    for (let i = 0; i < tripLength + 1; i++) {
        events.push([]);
    }
    ws.send(JSON.stringify({'type': 'eventsArr', 'data': events}))
}

function leaveInput(e) {
    e.preventDefault();
    $('#input-page').fadeOut(400);
    calcAvailability();
    loadDays();
    loadPeople();
}

function loadPeople() {
    document.getElementById("people-coming").innerHTML = "";
    for (let i = 0; i < people.length; i++) {
        let p = people[i];
        document.getElementById("people-coming").innerHTML += 
        `<li>
            <div class="person-info">
                <div class="person-info-title">${p.name}</div>
                Availability
                <div class="person-info-time">Start: ${moment(p.aStart).format('MM-DD-YYYY')}</div>
                <div class="person-info-time">End: ${moment(p.aEnd).format('MM-DD-YYYY')}</div>
            </div>
        </li>`;
    }
}

function loadDays() {
    let tripLength = moment.duration(endDate.diff(startDate)).days();
    for (let i = 0; i < weekdays.length && i < tripLength; i++) {
        let iDate = moment(startDate);
        iDate = iDate.add(i, 'days').add(dayDisplayOffset, 'days');
        document.getElementById("week-day-name-" + i.toString()).innerHTML = 
            iDate.format("ddd, MMM Do YYYY");
        let withinTrip = true;
        let distStart = moment.duration(iDate.diff(startDate)).days();
        if (distStart < 0) withinTrip = false;
        let distEnd = moment.duration(iDate.diff(endDate)).days();
        if (distEnd > 0) withinTrip = false;
        if (withinTrip) {
            document.getElementById("week-day-pane-" + i.toString()).style.backgroundColor = '#bbdfbd';
            document.querySelector("#week-day-pane-" + i.toString() + " > div.event-add-button-wrap").style.display = 'initial';
        } else {
            document.getElementById("week-day-pane-" + i.toString()).style.backgroundColor = null;
            document.querySelector("#week-day-pane-" + i.toString() + " > div.event-add-button-wrap").style.display = 'none';
        }
    }
}

function changeDayDisplayOffset(direction) {
    if (direction == "left") {
        dayDisplayOffset -= 1;
    } else {
        dayDisplayOffset += 1;
    }
    loadDays();
    loadEvents();
}

function render() {
    loadDays();
    loadBudget();
    loadEvents();
    loadPeople();
}

function resetAll() {
    events = [];
    budgetItems = [];
    people = [];
    calculateBudget();
    if (isSwitched) handleSwitch();
    ws.send(JSON.stringify({type: 'reset'}));
    $.post({
        url: "/setDestination",
        data: {
            'destination': ''
        },
        success: (e) =>{
            console.log(e)
        }
    })
    render();
}

function loadBudget() {
    var table = document.getElementById("budget-items");
    $("#budget-items tbody tr").remove();
    
    // document.getElementById("budget-items").innerHTML = "";
    if (budgetItems.length > 0){
        var headerRow = table.insertRow(-1);
        var hcell0 = document.createElement("TH");
        hcell0.innerHTML = "Person";
        headerRow.appendChild(hcell0)
        var hcell1 = document.createElement("TH");
        hcell1.innerHTML = "Item";        
        headerRow.appendChild(hcell1)
        var hcell2 = document.createElement("TH");
        hcell2.innerHTML = "Cost";
        headerRow.appendChild(hcell2)
    }
    for (let i = 0; i < budgetItems.length; i++) {
        let item = budgetItems[i];
        // document.getElementById("budget-items").innerHTML += "<li>" + item.name + ": $" + item.cost + "</li>"
        var row = table.insertRow();
        var cell0 = row.insertCell(0);
        var cell1 = row.insertCell(1);
        var cell2 = row.insertCell(2);
        cell0.innerHTML = item.person;
        cell1.innerHTML = item.name;
        cell2.innerHTML = "$" + item.cost;
    }
}

function addBudgetItem(person, name, cost) {
    if(typeof(person)!=='string'){
        person = person.value;
        name = name.value;
        cost = cost.value;
    }
    let item = {person: person, name: name, cost: cost};
    console.log(item)
    ws.send(JSON.stringify({type: 'budget', person: person, name: name, cost:cost}))
    budgetItems.push(item);
    loadBudget();
    calculateBudget();
}

function calculateBudget(){
    totalCost = 0;
    for(i in budgetItems){
        totalCost+=parseInt(budgetItems[i]['cost']);
    }
    document.getElementById('budget-total').innerHTML = totalCost;
    splitCosts();
}

function splitCosts(){
    console.log(people)
    // let people = [];
    // for(i in budgetItems){
    //     people.push(budgetItems[i]['person']);
    // }
    // people = Array.from(new Set(people));
    let personPaid = {};
    let personOwed = {};
    let owedPayments = {};
    for(j in people){
        let totalPaid = 0;
        for(k in budgetItems){
            if(budgetItems[k]['person'] == people[j]['name']){
                totalPaid += parseInt(budgetItems[k]['cost']);
            }
        }
        personPaid[people[j]['name']] = totalPaid
    }
    let numberPeople = people.length;
    perPersonCost = totalCost / numberPeople

    for(person in personPaid){
        personOwed[person] = personPaid[person] - perPersonCost
    }
    console.log(personOwed)
    for(oPerson in personOwed){
        if(personOwed[oPerson] == 0){
            console.log(oPerson + " is settled")
            // owedPayments[oPerson] = "settled"
            delete personOwed[oPerson]
        }
        else if(personOwed[oPerson] > 0){
            while(personOwed[oPerson] > 0){
                for(pPerson in personOwed){
                    if(personOwed[pPerson] < 0){
                        personOwed[pPerson] += personOwed[oPerson]  
                        if(personOwed[pPerson] > 0){
                            let difference = 0 - personOwed[pPerson]
                            let paidDifference = personOwed[oPerson] + difference
                            personOwed[pPerson] += difference
                            personOwed[oPerson] = -difference
                            console.log(pPerson + " pays " + oPerson + " $" + paidDifference )
                            if(pPerson in owedPayments){
                                owedPayments[pPerson] = owedPayments[pPerson].concat("; " + oPerson + " $" + paidDifference)
                            }
                            else{
                                owedPayments[pPerson] = "you need to pay " + oPerson + " $" + paidDifference;
                            }
                        }
                        else if(personOwed[pPerson] == 0){
                            console.log(pPerson + " pays " + oPerson + " $" + personOwed[oPerson]);
                            if(pPerson in owedPayments){
                                owedPayments[pPerson] = owedPayments[pPerson].concat("; " + oPerson + " $" + personOwed[oPerson])
                            }
                            else{
                                owedPayments[pPerson] = "you need to pay " + oPerson + " $" + personOwed[oPerson];
                            }
                            personOwed[oPerson] = 0;
                        }
                        else {
                            let difference = personOwed[oPerson]
                            console.log(pPerson + "pays " + oPerson + " $" + difference + " but still owes " + personOwed[pPerson])
                            if(pPerson in owedPayments){
                                owedPayments[pPerson] = owedPayments[pPerson].concat("; " + oPerson + " $" + difference)
                            }
                            else{
                                owedPayments[pPerson] = "you need to pay " + oPerson + " $" + difference
                            }
                            owedPayments[pPerson]
                            personOwed[oPerson] = 0;
                        }
                    }
                }
            }
        }
        else{
            console.log(oPerson)
        }
    }
    console.log(owedPayments)
    // var table = document.getElementById("budget-repayments");
    // $("#budget-repayments tbody tr").remove();

    // if (!jQuery.isEmptyObject(owedPayments)){
    //     var headerRow = table.insertRow(-1);
    //     var hcell0 = document.createElement("TH");
    //     hcell0.innerHTML = "Person";
    //     headerRow.appendChild(hcell0)
    //     var hcell1 = document.createElement("TH");
    //     hcell1.innerHTML = "Repayment details";        
    //     headerRow.appendChild(hcell1)
    // }
    
    for (item in owedPayments) {
        if(item == local_name){
            document.getElementById('budgetRepay').innerHTML = owedPayments[item]
        }
    }
}

$('#budgetModal').on('hidden.bs.modal', function (e) {
$(this)
    .find("input,textarea")
        .val('')
            .end();
});

$('#travelModal').on('shown.bs.modal', function (e) {
    
    //make call to get the flight data from the backend
    getBackendFlights();
    let content = $(this).find('.container-fluid');
    content.text("")
    for (i = 0; i < gottenFlights.length; i++) {
        let curr_info = gottenFlights[i];
        let flight_name = curr_info['AirLine'];
        let name = '<h1>'+ flight_name +'</h1>';
        let flight_price = curr_info['Price']
        let price = '<p>$' + String(flight_price)  +'</p>';
        let flight_info = `<div class=flightContainer  data-dismiss="modal" onclick='addFlight("${local_name}","${flight_name}","${flight_price/2}")'>` + name + price + `</div>`;
        content.append(flight_info);
    }
 
  })

function addFlight(eventPerson, eventItem, eventCost) {
    let start = 0;
    let final = events.length - 1;
    let person = eventPerson;
    let name = eventItem;
    let c = eventCost;
    ws.send(JSON.stringify({type:'event', name: name, cost: c, day: start}));
    ws.send(JSON.stringify({type:'event', name: name, cost: c, day: final}));
    addBudgetItem(person, name, c);
    addBudgetItem(person, name, c);
    events[start].push({person: person, name: name, cost: c});
    events[final].push({person: person, name: name, cost: c});

    loadDays();
    calculateBudget();   
}

$('#accomodationsModal').on('shown.bs.modal', function (e) {
    
    getBackendHotels();

    let content = $(this).find('.container-fluid');
    content.text("")

    for (i = 0; i < gottenHotels.length; i++) {
        let curr_info = gottenHotels[i];
        let photo = '<img src='+ curr_info['photo'] +'>';
        let hotel_name = curr_info['name'];
        let name = '<h1>'+ hotel_name  +'</h1>';
        let hotel_price = curr_info['price']
        let price = '<p>$' + String(hotel_price) +'</p>';
        let rating = '<p>'+ 'Average Review: '+ String(curr_info['avg review']) +'</p>';
        let titles = '<div class="titles">' + name + price + rating + '</div>';
        let hotel_info = `<div class=accomodationsContainer data-dismiss="modal" onclick='addAccomodation("${local_name}","${hotel_name}","${hotel_price}")'>` + photo + titles + `</div>`;
        content.append(hotel_info);
      }
  })

function addAccomodation(eventPerson, eventItem, eventCost){
    addBudgetItem(eventPerson, eventItem, eventCost)
}

function loadEvents() {
    for (let i = 0; i < 7; i++) {
        document.getElementById(`week-${i}-events`).innerHTML = "";
    }
    for (let i = 0; i < 7; i++) {
        let iDate = moment(startDate);
        iDate = iDate.add(i, 'days').add(dayDisplayOffset, 'days');
        let index = moment.duration(iDate.diff(startDate)).days();
        let tripLength = moment.duration(endDate.diff(startDate)).days() + 1;
        if (index < 0 || index >= tripLength) {
            continue;
        }
        for (let j = 0; j < events[index].length; j++) {
            document.getElementById(`week-${i}-events`).innerHTML +=
            `<div class="event">
                <div class="event-title">${events[index][j].name}</div>
                <div class="event-cost">${events[index][j].cost}</div>
            </div>`;
        }
    }
}

function addEvent(eventPerson, eventItem, eventCost) {
    let i = nextEventDay;
    let iDate = moment(startDate);
    iDate = iDate.add(i, 'days').add(dayDisplayOffset, 'days');
    let index = moment.duration(iDate.diff(startDate)).days();
    let person = eventPerson;
    let name = eventItem;
    let c = eventCost;
    ws.send(JSON.stringify({type:'event', name: name, cost: c, day: index}));
    addBudgetItem(person, name, c);
    events[index].push({person: person, name: name, cost: c});
    document.getElementById(`week-${i}-events`).innerHTML +=
    `<div class="event">
        <div class="event-title">${name}</div>
        <div class="event-cost">$${c}</div>
    </div>`;
    calculateBudget();
}

var isSwitched = false;
function handleSwitch() {
    if (!isSwitched) {
        $('#week-frame').animate({
            'width': '=65%'
        }, 375);
        setTimeout(() => $('#budget-frame').fadeIn(375), 200);
        isSwitched = true;
    } else {
        $('#week-frame').animate({
            'width': '=90%'
        }, 375);
        $('#budget-frame').fadeOut(100);
        isSwitched = false;
    }
}

ws.onmessage = function(serverData){
    data = JSON.parse(serverData.data)
    if(data['type'] == 'event'){
        events = data['data'];
        loadEvents();
        loadBudget();
        calculateBudget();
    }
    else if(data['type'] == 'budget'){
        budgetItems = data['data'];
        if(budgetItems.length == 0){
            if (isSwitched) handleSwitch();
            render();
        }
        loadEvents();
        loadBudget();
        calculateBudget();
    }
    else if(data['type'] == 'userList'){
        people = data['data'];
        for(i in people){
            people[i]['aStart'] = moment(people[i]['aStart'], 'YYYY-MM-DD,HH:mm:ss.sssZZ');
            console.log(moment(people[i]['aStart'], 'YYYY-MM-DD,HH:mm:ss.sssZZ'))
            people[i]['aEnd'] = moment(people[i]['aEnd'], 'YYYY-MM-DD,HH:mm:ss.sssZZ');
        }
        console.log(people)
        calcAvailability();
        loadPeople();
        // loadDays();
    }
    else if(data['type'] == 'reset'){
        document.location.reload(true);
    }
    else{
        console.log(data)
    }
}

function getBackendFlights() {
    $.ajax({
        type: "POST",
        url: "/flights",
        async: false,
        data: {
            depart: startDate.format('YYYY-MM-DD'),
            return: endDate.format('YYYY-MM-DD'),
            startPoint: "YYZ",
            destination: destination
        },
        success: (e) => {
            gottenFlights = e;
        }
    })
}

function getBackendHotels() {
    $.ajax({
        type: "POST",
        url: "/acco",
        async: false,
        data: {
            city: destination,
            checkin: startDate.format('YYYY-MM-DD'),
            checkout: endDate.format('YYYY-MM-DD'),
            numPeople: people.length
        },
        success: (e) => {
            gottenHotels = e;
        }
    })
}