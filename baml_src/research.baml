function Research(arg:string) -> string {
    client GLM4Flash
    prompt #"
        Make a knowledge note about {{arg}}
    "#
}