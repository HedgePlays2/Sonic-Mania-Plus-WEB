function pressKey(key){

    document.dispatchEvent(
        new KeyboardEvent("keydown", {
            key:key
        })
    );

}


function releaseKey(key){

    document.dispatchEvent(
        new KeyboardEvent("keyup", {
            key:key
        })
    );

}


function button(id,key){

    let btn=document.getElementById(id);


    btn.addEventListener("touchstart",()=>{
        pressKey(key);
    });


    btn.addEventListener("touchend",()=>{
        releaseKey(key);
    });

}


button("left","ArrowLeft");
button("right","ArrowRight");
button("jump","z");
button("spin","x");
