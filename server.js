const express = require(`express`);
const app = express();
app.use(express.urlencoded({extended: true})) 
app.set(`view engine`, `ejs`)
app.use(`/public`, express.static(`public`)); //퍼블릭폴더 쓰겠다는 말. 이 안에 css넣으면 된다.

//method override : 폼태그에서 put, delete 가능
const methodOverride = require(`method-override`)
app.use(methodOverride(`_method`))

//passport passport-local express-session
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');

app.use(session({secret : '비밀코드', resave : true, saveUninitialized: false}));
app.use(passport.initialize());
app.use(passport.session()); 


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
  응답.render(`index.ejs`)
});

app.get(`/write`, (요청, 응답) => {
  응답.render(`write.ejs`)
});



app.post('/add', (요청, 응답)=>{
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
app.get(`/detail/:id`, (req, res)=>{
  db.collection(`post`).findOne({ _id: parseInt(req.params.id) }, (err, result)=>{
    if(err) return console.log(err);
    res.render(`detail.ejs`, { data : result });
  })
  
})



app.get(`/edit/:id`, (req, res )=>{
  db.collection(`post`).findOne({ _id: parseInt(req.params.id) }, (err,result)=>{
    if(err) return console.log(err);
    res.render(`edit.ejs`, { post : result })
  })
})
app.put(`/edit`, (req, res)=>{
  db.collection(`post`).updateOne({ _id: parseInt(req.body.id) }, { $set : { 제목: req.body.title, 날짜: req.body.date } }, (err, result)=>{
    if(err) return console.log(err);
    res.redirect(`/list`);
  })
})




//로그인
app.get('/login', (req, res)=>{
  res.render('login.ejs')
});
//로컬 방식으로 검사
app.post('/login', passport.authenticate(`local`, { failureRedirect : '/fail'}), (req, res)=>{
  res.redirect(`/`);
});

//로그인 검사절차
passport.use(new LocalStrategy({
  usernameField: 'id',
  passwordField: 'pw',
  session: true,
  passReqToCallback: false,
}, function (입력한아이디, 입력한비번, done) {
  //console.log(입력한아이디, 입력한비번);
  db.collection('login').findOne({ id: 입력한아이디 }, function(err, result)  {
    if (err) return done(err)
    if (!result) return done(null, false, { message: '존재하지않는 아이디입니다.' })
    if (입력한비번 == result.pw) {
      return done(null, result)
    } else {
      return done(null, false, { message: '비밀번호가 틀렸습니다.' })
    }
  })
}));


//세션만들기
passport.serializeUser((user, done)=>{//id를 이용해서 세션을 저장시키는 코드(로그인성공시 발동) 첫인자는 위 코드의 result다.
  done(null, user.id)
});
passport.deserializeUser((아이디, done)=>{//이 세션 데이터를 가진 사람을 DB에서 찾아줘.(마이페이지 접속시)
  db.collection('login').findOne({id: 아이디}, (err, result)=>{
    done(null, result )
  })
});


//마이페이지 요청할 경우
app.get(`/mypage`, didyouLogin, (req, res)=>{
  res.render('mypage.ejs', { data: req.user })
})
function didyouLogin(req, res, next){// (로그인 후 세션이 있으면 계속 req.user가 항상 있음)
  if(req.user){
    next()
  }else{
    res.send(`로그인 상태가 아닙니다.`)
  }
}

//검색기능
app.get('/search', (req, res)=>{
  console.log(req.query.value)
  let searchCondition = [
    {
      $search: {
        index: 'titleSearch', //내가 만든 아틀라스 서치인덱스 이름
        text: {
          query: req.query.value,
          path: '제목'  // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
        }
      }
    }
  ]
  db.collection('post').aggregate(searchCondition).toArray((err, result)=>{
    console.log(result)
    res.render('search.ejs', { posts: result })
  })
})


//회원가입
app.get('/signin', (req, res)=>{
  res.render('signin.ejs')
})
app.post('/register', (req, res)=>{
  db.collection('login').findOne({id: req.body.id}, (err, result)=>{
    if(result == null) {
      db.collection('login').insertOne({id: req.body.id, pw: req.body.pw},()=>{
        res.redirect('/')
      })
    }else if(result != null){
      res.send('이미 존재하는 아이디입니다.')
    }
  })
})