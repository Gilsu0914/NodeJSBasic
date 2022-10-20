const express = require(`express`);
const app = express();
app.use(express.urlencoded({extended: true})) 
app.set(`view engine`, `ejs`)

let db;
const MongoClient = require(`mongodb`).MongoClient;

MongoClient.connect(`mongodb+srv://gilsuAdmin:1q2w3e4r@cluster0.tkfuxtn.mongodb.net/?retryWrites=true&w=majority`, (error, client)=>{
  if(error){ return console.log(error) };
  db = client.db(`todoapp`) //todoapp database에 연결요청


  app.listen(8080, () => {
    console.log(`listening on 8080`)
  });
  
  // db.collection(`post`).insertOne({ _id: 0 , name: `gilsu`, age: 30 }, (error, result)=>{ //post라고 지은 컬렉션에, 저장할데이터 insert하고, 그 다음 콜백함수 실행
  //   console.log(`저장완료`);
  // });

})

app.get(`/`, function(요청, 응답){
  응답.sendFile(__dirname + `/index.html`)
});

app.get(`/write`, (요청, 응답) => {
  응답.sendFile(__dirname + `/write.html`)
});



app.post('/add', (요청, 응답)=>{
  응답.send(`전송 완료했습니다.`);
  db.collection(`counter`).findOne({name: `게시물갯수`}, (error, result)=>{
    console.log(result.totalPosts);
    let num = result.totalPosts
  
    db.collection(`post`).insertOne({ _id: num + 1, 제목: 요청.body.title , 날짜: 요청.body.date }, (error, result)=>{
      console.log(`날짜, 제목을 post라는 컬력션에 저장완료`)
      //counter라는 컬렉션에 있는 totalPost항목도 1증가시켜야 함.
      db.collection(`counter`).updateOne({ name: `게시물갯수` },{ $inc: { totalPosts: 1 }}, (error, result)=>{
        if(error) return console.log(error);
      });
    })  
  })
})

// 누가 /list 로 get요청으로 접속하면 
// 실제 db에 저장된 데이터들로 예쁘게 꾸면진 html을 보여줌
app.get(`/list`, (요청, 응답)=>{

  db.collection(`post`).find().toArray((error, result)=>{ ///db의 post컬렉션 안의 모든 데이터 꺼내기 + array화
    if(error){return console.log(error)};
    응답.render(`list.ejs`, { posts: result });
  });
});



app.delete(`/delete`, (req, response) => {
  req.body._id = parseInt(req.body._id);
  db.collection(`post`).deleteOne(req.body, (err, result)=>{
    response.status(200).send({message: `서버로부터: 성공`});
  })
});